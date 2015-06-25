---
layout: page
title: "Admiral: Easy Server Management on AWS for Meteor Apps"
---

I built [Fetching](http://fetching.io), a Meteor application that depends on MongoDB and ElasticSearch. I didn't find a ready-made solution I liked for easily deploying and managing my Meteor app on AWS so I created [Admiral](https://github.com/flippyhead/admiral). There were a few features I was after:

* Easy single-click (or command) deployment of new code.
* The ability to manage server configuration as code, that could be checked into source control
* A simple, modular design that could be easily extended to support other server types (beyond MongoDB and ElasticSearch)
* Option to include only the components I need for a given project

I spent a good deal of time researching the many technologies AWS provides and concluded that a combination of OpsWorks and CloudFormation was a great way to go; especially after reading [this blog post](http://www.thoughtworks.com/mingle/news/scaling/2015/01/06/How-Mingle-Built-ElasticSearch-Cluster.html).

## AWS

[OpsWorks](http://aws.amazon.com/opsworks/) is the AWS approach to Chef and provides some niceties including a nice web UI, a bunch of existing best-practices recipes, support for a variety of deployment methods, monitoring and much more.

[CloudFormation](http://aws.amazon.com/cloudformation/) is a JSON-based template language that lets you define your AWS infrastructure including nearly all AWS components (e.g. Route53 DNS, elastic load balancers, servers types and locations, VPN stuf, etc.). AWS deals with migrating your infrastructure as your CloudFormation templates change. Using templates, once you get the hang of them, if way better than configuring every manually. To simplify setup, Admiral comes with production ready sample CloudFormation templates for MongoDB, ElasticSearch and Meteor servers.

Since you can configure your Chef scripts from within CloudFormation templates, the combination of OpsWorks and CloudFormation is a fantastic way to manage server infrastructure as code.

## Getting Started Tutorial

In this brief tutotaly we're going to walk through setting up an AWS cluster to host your Meteor app. The basic steps are:

1. Create new repo(s) to hold your server configurations.
2. Get setup with a base CloudFormation template and configuration.
3. Provision and startup server instances.
4. _Repeat the steps 1 - 3 for your MongoDB and optionally ElasticSearch cluster._
5. Configure your Meteor app to work with OpsWorks.
6. Build and push your Meteor application to S3.
7. Deploy your Meteor app to OpsWorks.

### Repository Setup and Configuration

For each server type, I recommend creating a separate repository to store and track your configuration. For Fetching I've got three: `opsworks-meteor`, `opsworks-elasticsearch` and `opsworks-mongo`. Each one has these files:

{% highlight bash %}
.gitignore
.rbenv-vars
.ruby-version
CloudFormation.template   // for this server type
Gemfile                   // to include admiral modules
Gemfile.lock
production.json           // custom configurations
staging.json
{% endhighlight %}

To get started with a production ready template use:

`admiral cf init <server type>`

where `server type` is one of mongo, meteor, or elasticsearch. Of course, you'll have to customize some settings in the included CloudFormation template such as security groups and DNS entries.

Although your CloudFormation-based configurations are not required to use OpsWorks, the included defaults do. You'll need to include `admiral-opsworks` in your Gemfile in addition to `admiral-cloudformation` to work with OpsWorks via admiral.

Once your templates re properly written and your environment parameter specified, you can create your AWS infrastructure with:

`admiral cf create --env <environment>`

where `environment` refers to a parameter JSON file such as staging or production. Defaults to production. This will validate your CloudFormation template then task AWS with ordering and building out your infrastructure. You can visit the AWS console to monitor the build process.

Admiral requires a few shell environment values to be set in order to authenticate with AWS. These are not stored in the environment configuration files because it's always a bad idea to check into source control passwords and the like.

The recommended setup uses the handy rbenv `.rbenv-vars` file manage these for you. But if you already have your AWS credentials set (e.g. via .profile) it should "just work". The required variables for admiral-cloudformation are:

{% highlight bash %}
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=yyy
AWS_REGION=us-west-2        // set to whatever region you want to use
{% endhighlight %}

### Provisioning Servers using OpsWorks

Once your infrastructure components have been built it's time to provision and start your actual servers! To start things up simply use:

`admiral ow provision`

depending on the `InstanceCount` and `InstanceType` variables in your environment JSON config, you'll get a bunch of new servers all configured according to the setup specific in your CloudFormation template.

Later if you make any configuration changes, the same command will manage creating replacement servers and taking down old servers such that there is always `InstanceCount` running and serving your applications.

### Configure your Meteor app

Now that you've got servers up and running, you need to deploy your actual application. To get NPM packages installed correctly on OpsWorks you can use [Chef deploy hooks](http://docs.aws.amazon.com/opsworks/latest/userguide/workingcookbook-extend-hooks.html) to run commands after each deploy. For most projects you can simply create a `deploy` directory in the root of your Meteor project and add a `after_deploy.rb` file with this content:

{% highlight ruby %}
run "cd #{release_path}/programs/server && npm i"
{% endhighlight %}

This will correctly install any needed NPM modules required by standard Meteor builds whenever you deploy.

### Upload your built Meteor app

You're now all set to deploy your app and run it on AWS. Admiral relies on the OpsWorks system for deploying applications via S3. To use this you'll need to add two more environment variables that specify to where your builds should be sent:

{% highlight bash %}
ADMIRAL_DEPLOY_BUCKET=my-builds     // an existing bucket
ADMIRAL_DEPLOY_NAME=my-app          // with above, your app will uploaded to S3 here: /my-builds/my-app.tar.gz
{% endhighlight %}

Then from your Meteor app root (where you've installed admiral-meteor using the Gemfile), you'll use:

`admiral meteor push --tag v0.0.1`

or whatever tag (or none) that you want for a given release. This will build your Meteor app locally using the correct architecture, then push it to S3.

### Deploy your application

Finally, now that your app has been built and pushed, you can deploy it with:

`admiral ow deploy myapp`

where myapp is whatever name you specified in `ADMIRAL_DEPLOY_NAME`. By setting these values differently for different meteor apps you can deploy many different applications on the same cluster (for example using [Meteor Cluster](https://github.com/meteorhacks/cluster)).

## Typical Work-flow (after setup)

The work-flow for managing your servers with Admiral (after the initial setup) is like this:

0. Make a change to your CloudFormation template or environment JSON files.
1. Commit the change to your source repository.
2. Run `admiral cf update`.
3. Your template changes are validated, pushed to AWS.
4. Changes to your infrastructure are made automatically.

 Because CloudFormation updates can cause downtime when servers are upgraded, if you have multiple servers of a given type (for example, an ElasticSearch cluster with multiple nodes) Admiral will manage creating new servers with your changes before replacing old ones. This allows you to upgrade entire clusters with zero downtime.

Uploading new Meteor builds is really easy, you'll almost always do:

`admiral meteor push`

followed by

`admiral ow deploy myapp`

where `myapp` is the name of the app you want to deploy. That's it!

## Environments and Parameters

The CloudFormation template language let's you pass in parameters so you can adjust how each server of the same type is setup. For example, you can have a staging cluster setup with fewer servers of a smaller type and with different DNS settings than a production or testing cluster. This makes it trivial to duplicate your entire infrastructure as needed.

This works by creating a second set of JSON files that contain values to be applied to any [Parameters](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/parameters-section-structure.html) to your CloudFormation templates. For example, here's a `production.json` file for an ElasticSearch cluster:

{% highlight js %}
{
  "Route53ZoneName": "example.io.",
  "SearchDomainName": "search.example.io",
  "SSLCertificateName": "search.example.io",
  "SshKeyName": "production",
  "InstanceCount":"2",
  "InstanceType": "c3.large",
  "ElasticSearchVersion": "1.4.4",
  "ElasticSearchAWSCloudPluginVersion": "2.4.1",
  "SearchUser":"admin",
  "SearchPassword":"example-password",
  "ClusterName": "production-cluster",
  "MinMasterNodes": "1",
  "SecurityGroupLoadBalancer": "sg-8aab365abc",
  "SecurityGroupSearchLayer": "sg-9e9d3abc"
}
{% endhighlight %}

And here's the CloudFormation template for an ElasticSearch cluster:

{% highlight js %}
{
    "AWSTemplateFormatVersion": "2010-09-09",
    "Parameters": {
        "CookbookRepo": {
            "Description": "GitURL",
            "Type": "String",
            "Default": "https://github.com/ThoughtWorksStudios/opsworks-elasticsearch-cookbook"
        },

        "CookbookRepoRevision": {
            "Description": "Git Revision/Tag",
            "Type": "String",
            "Default": "0.0.1"
        },

        "ElasticSearchVersion": {
            "Description": "The version of ElasticSearch to install.",
            "Type": "String",
            "Default": "1.3.5"
        },

        "AwsRegion": {
            "Description": "The AWS region",
            "Type": "String",
            "Default": "us-west-2"
        },

        "ElasticSearchAWSCloudPluginVersion": {
            "Description": "The version of the ElasticSearch AWS Cloud Plugin to install. Note that this version MUST correspond to the targeted version of ElasticSearch. See https://github.com/elasticsearch/elasticsearch-cloud-aws for the version compatibility table.",
            "Type": "String",
            "Default": "2.3.0"
        },

        "RecipeList": {
            "Description": "The list of cookbooks to include when setting up the cluster.",
            "Type": "CommaDelimitedList",
            "Default":"apt, ark,elasticsearch, elasticsearch::aws, elasticsearch::proxy, java, layer-custom::esplugins, layer-custom::allocation-awareness, layer-custom::esmonit, layer-custom::cloudwatch-custom"
        },

        "SSLCertificateName": {
            "Description": "The SSL certificate.",
            "Type": "String"
        },

        "InstanceCount": {
            "Description": "Number of nodes to spin up in the cluster. This also configures the `expected_nodes` setting in ElasticSearch, which serves as a hint when the cluster considers shard reallocation.",
            "Type": "String"
        },

        "InstanceType": {
            "Description": "The type of instance to launch.",
            "Type": "String",
            "Default": "t2.small"
        },

        "MinMasterNodes": {
            "Description": "Number of master eligible nodes visible to a given node before accepting requests. When this criterion is not satisfied, a given node will assume it has split off from from the cluster. This setting this helps avoid a catastrophic split-brain scenario in the cluster. This is typically is set to [N/2 + 1] nodes.",
            "Type": "String"
        },

        "SearchUser": {
            "Description": "username to access the ElasticSearch cluster.",
            "Type": "String"
        },

        "SearchPassword": {
            "Description": "password to access the ElasticSearch cluster.",
            "Type": "String"
        },

        "ClusterName": {
            "Description": "The name of the ElasticSearch cluster.",
            "Type": "String"
        },

        "Route53ZoneName": {
            "Description": "Route53 zone under which to setup the DNS record.",
            "Type": "String"
        },

        "SearchDomainName": {
            "Description": "Domain name to register for the cluster under Route53.",
            "Type": "String"
        },

        "SshKeyName": {
            "Description": "SSH key name for EC2 instances.",
            "Type": "String"
        },

        "PaperTrailHost": {
            "Description": "The PaperTrail endpoint hostname. Only required if you add the papertrail cookbook.",
            "Type": "String",
            "Default": "logs.papertrailapp.com"
        },

        "PaperTrailPort": {
            "Description": "The PaperTrail endpoint port. Only required if you add the papertrail cookbook.",
            "Type": "Number",
            "Default": 0,
            "MinValue" : "0",
            "MaxValue" : "65535"
        },

        "SecurityGroupLoadBalancer": {
            "Description": "The load balancer security group.",
            "Type": "String"
        },

        "SecurityGroupSearchLayer": {
            "Description": "The search layer security group.",
            "Type": "String"
        }

    },

    "Outputs": {
        "StackId": {
            "Description": "opsworks stack id ",
            "Value": { "Ref": "SearchStack"}
        },

        "LayerId": {
            "Description": "opsworks search layer id ",
            "Value": { "Ref": "SearchLayer"}
        }

    },

    "Resources": {

        "LoadBalancer" : {
            "Type" : "AWS::ElasticLoadBalancing::LoadBalancer",
            "Properties" : {
                "AvailabilityZones" : { "Fn::GetAZs" : "" },
                "Listeners" : [
                    {
                        "LoadBalancerPort" : "443",
                        "InstancePort" : "80",
                        "Protocol" : "HTTPS",
                        "SSLCertificateId": {
                            "Fn::Join": ["", ["arn:aws:iam::", { "Ref": "AWS::AccountId" }, ":server-certificate/", { "Ref" : "SSLCertificateName" }]]
                        }
                    }
                ],
                "HealthCheck" : {
                    "Target" : "TCP:80",
                    "HealthyThreshold" : "2",
                    "UnhealthyThreshold" : "8",
                    "Interval" : "30",
                    "Timeout" : "20"
                },
                "SecurityGroups": [
                    {"Ref": "SecurityGroupLoadBalancer"}
                ]
            }
        },

        "DNSRecord": {
            "Type" : "AWS::Route53::RecordSet",
            "Properties" : {
                "HostedZoneName" : {"Ref": "Route53ZoneName"},
                "Type" : "CNAME",
                "Name" : { "Ref": "SearchDomainName"},
                "ResourceRecords" : [ {"Fn::GetAtt":["LoadBalancer","DNSName"]}],
                "TTL" : "30"
            }
        },

        "ELBAttachment" : {
            "Type" : "AWS::OpsWorks::ElasticLoadBalancerAttachment",
            "Properties" : {
                "ElasticLoadBalancerName" : { "Ref" : "LoadBalancer" },
                "LayerId" : { "Ref" : "SearchLayer" }
            }
        },


        "SearchStack": {
            "Type": "AWS::OpsWorks::Stack",
            "Properties": {
                "Name": {
                    "Ref": "AWS::StackName"
                },
                "CustomJson": {
                    "java": {
                        "jdk_version": "7",
                        "oracle": {
                            "accept_oracle_download_terms": "true"
                        },
                        "accept_license_agreement": "true",
                        "install_flavor": "oracle"
                    },
                    "papertrail": {
                        "remote_host": { "Ref": "PaperTrailHost" },
                        "remote_port": { "Ref": "PaperTrailPort" },
                        "watch_files": [
                            { "filename": { "Fn::Join": ["", ["/usr/local/var/log/elasticsearch/", { "Ref": "ClusterName" }, ".log"]] }, "tag": "search" },
                            { "filename": { "Fn::Join": ["", ["/usr/local/var/log/elasticsearch/", { "Ref": "ClusterName" }, "_index_indexing_slowlog.log"]] }, "tag": "indexing-slowlog" },
                            { "filename": { "Fn::Join": ["", ["/usr/local/var/log/elasticsearch/", { "Ref": "ClusterName" }, "_index_search_slowlog.log"]] }, "tag": "search-slowlog" }
                        ]
                    },
                    "elasticsearch": {
                        "version": { "Ref": "ElasticSearchVersion" },
                        "plugins" : {
                            "elasticsearch/elasticsearch-cloud-aws": {
                                "version": { "Ref": "ElasticSearchAWSCloudPluginVersion" }
                            }
                        },
                        "nginx": {
                            "users": [{
                                "username": { "Ref": "SearchUser" },
                                "password": { "Ref": "SearchPassword" }
                            }],
                            "allow_cluster_api": "true",
                            "port": 80
                        },
                        "cluster": {
                            "name": { "Ref" : "ClusterName" }
                        },
                        "gateway": {
                            "expected_nodes": { "Ref": "InstanceCount" }
                        },
                        "discovery": {
                            "type": "ec2",
                            "zen": {
                                "minimum_master_nodes": { "Ref": "MinMasterNodes" },
                                "ping": {
                                    "multicast": {
                                        "enabled": false
                                    }
                                }
                            },
                            "ec2": {
                                "tag": {
                                    "opsworks:stack": {
                                        "Ref": "AWS::StackName"
                                    }
                                }
                            }
                        },
                        "path": {
                            "data": "/mnt/elasticsearch-data"
                        },
                        "cloud": {
                            "aws": {
                                "region": { "Ref": "AwsRegion" }
                            }
                        },
                        "custom_config": {
                            "cluster.routing.allocation.awareness.attributes": "rack_id",
                            "index": "\n  analysis:\n    analyzer:\n      default_index:\n        filter:\n        - standard\n        - lowercase\n        - snowball\n        tokenizer: standard\n      default_search:\n        tokenizer: standard\n        filter:\n        - standard\n        - lowercase\n        - snowball\n"
                        }
                    }
                },
                "ServiceRoleArn": {
                    "Fn::Join": ["", ["arn:aws:iam::", { "Ref": "AWS::AccountId" }, ":role/aws-opsworks-service-role"]]
                },
                "DefaultInstanceProfileArn": {
                    "Fn::Join": ["", ["arn:aws:iam::", { "Ref": "AWS::AccountId" }, ":instance-profile/aws-opsworks-ec2-role"]]
                },
                "ConfigurationManager": {
                    "Name": "Chef",
                    "Version": "11.10"
                },
                "ChefConfiguration": {
                    "BerkshelfVersion": "3.1.3",
                    "ManageBerkshelf": true
                },
                "DefaultOs": "Amazon Linux 2015.03",
                "DefaultRootDeviceType": "ebs",
                "DefaultSshKeyName": { "Ref": "SshKeyName" },
                "UseCustomCookbooks": true,
                "UseOpsworksSecurityGroups": false,
                "CustomCookbooksSource": {
                    "Type": "git",
                    "Url": {
                        "Ref": "CookbookRepo"
                    },
                    "Revision": { "Ref": "CookbookRepoRevision" }
                }
            }
        },

        "SearchLayer": {
            "Type": "AWS::OpsWorks::Layer",
            "Properties": {
                "StackId": {
                    "Ref": "SearchStack"
                },
                "Name": "Search",
                "Type": "custom",
                "Shortname": "search",
                "CustomRecipes": {
                    "Setup": { "Ref": "RecipeList" }
                },
                "EnableAutoHealing": false,
                "AutoAssignElasticIps": false,
                "AutoAssignPublicIps": true,
                "VolumeConfigurations": [
                    {
                        "MountPoint": "/mnt/elasticsearch-data",
                        "NumberOfDisks": 1,
                        "Size": 200,
                        "VolumeType": "gp2"
                    }
                ],
                "CustomSecurityGroupIds": [
                    {"Ref": "SecurityGroupSearchLayer"}
                ]
            }
        }

    }
}
{% endhighlight %}

To apply the `production.json` values to the above `CloudFormation.template` you'd simply:

`admiral cf update --environment production.json --template CloudFormation.template`

You check in your templates and JSON configurations into your source tree and can easily migrate or rollback to specific configurations.
