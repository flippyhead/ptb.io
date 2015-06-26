---
layout: page
title: "Introducing Admiral"
---

## A Toolkit for AWS CloudFormation, OpsWorks and Meteor

When I built [Fetching](http://fetching.io), a Meteor application that depends on MongoDB and ElasticSearch, I needed an easy way to manage its servers and deployments. I didn't find a ready-made solution I liked so I created [Admiral](https://github.com/flippyhead/admiral). There were a few key features I was after:

* Easy single click/command deployment of updates.
* Ability to fun multiple applications in a cluster of services.
* The ability to manage server configuration as code and in source control.
* A simple, modular design that could be easily extended to support other server types (beyond MongoDB and ElasticSearch)
* Ability to include only the components I need for a given project
* Support for rolling server upgrades causing no downtime

The project is [hosted on GitHub](https://github.com/flippyhead/admiral) and [available via RubyGems](https://rubygems.org/gems/admiral).

## AWS

I knew I wanted to go with AWS and settled on a combination of CloudFormation and OpsWorks. In particular I found [this blog post](http://www.thoughtworks.com/mingle/news/scaling/2015/01/06/How-Mingle-Built-ElasticSearch-Cluster.html) to be very useful.

[OpsWorks](http://aws.amazon.com/opsworks/) is the AWS approach to Chef and provides some niceties including a clean web UI, a bunch of existing well tested recipes, support for a variety of deployment methods, monitoring and much more.

[CloudFormation](http://aws.amazon.com/cloudformation/) is a JSON-based template language that lets you define your AWS infrastructure including nearly all [AWS components](http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-template-resource-type-ref.html) (e.g. Route53 DNS, Elastic Load Balancers, Instance types and configurations, VPN stuff, etc.). AWS deals with migrating your infrastructure as your CloudFormation templates change. Using templates, once you get the hang of them, if way better than configuring everything manually and repeatedly. Since you can configure your Chef scripts from within CloudFormation templates, the combination of OpsWorks and CloudFormation is a fantastic way to manage server infrastructure as code.

## Just what you need

Admiral is composed of modules that each offer discrete functionality. They all work independently and you only include what you need for a given project. You can use admiral-cloudformation to manage AWS and never deal with OpsWorks or Meteor. My hope is that new modules will be developed to handle other requirements and features.

The three current modules (ruby gems) are:

* admiral-cloudformation
* admiral-opsworks
* admiral-meteor

You only need to include the one you need. Dependencies are automatically resolved.

## Getting Started Tutorial

In this brief tutorial we're going to walk through setting up an AWS cluster to host your Meteor app. The basic steps are:

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
.rbenv-vars               # optional but handy
.ruby-version
CloudFormation.template   # for this server type
Gemfile                   # to include admiral modules
Gemfile.lock
production.json           # custom configurations
staging.json
{% endhighlight %}

To get started with a production ready template use:

{% highlight bash %}
admiral cf init SERVER_TYPE
{% endhighlight %}

where `SERVER_TYPE` is one of `mongo`, `meteor`, or `elasticsearch`. You'll have to customize a couple settings in the included CloudFormation template such as security groups and DNS entries. You can simply try uploading the default template (using the command below) and follow the errors AWS returns to guide your customizations.

Although your CloudFormation-based configurations are not required to use OpsWorks, the included defaults do. You'll need to include `admiral-opsworks` in your Gemfile in addition to `admiral-cloudformation` to work with OpsWorks via admiral.

Admiral requires a few shell environment values to be set in order to authenticate with AWS. These are not stored in the environment configuration files because it's always a bad idea to check into source control passwords and the like.

The recommended setup uses the handy rbenv `.rbenv-vars` file to manage these for you. But if you already have your AWS credentials set (e.g. via your .profile) it should "just work". The required variables for admiral-cloudformation are:

{% highlight bash %}
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=yyy
AWS_REGION=us-west-2        // set to whatever region you want to use
{% endhighlight %}

Once your CloudFormation and environment templates are customized, and you've set the above environment variables, you can create your AWS infrastructure with:

{% highlight bash %}
admiral cf create --env ENVIRONMENT
{% endhighlight %}

where `ENVIRONMENT` refers to a parameter JSON file such as `staging` or `production`. The default is `production`. This will validate your CloudFormation template then task AWS with building out your infrastructure. It manages ordering things correctly, resolving dependencies, and managing events. You can visit the AWS console to monitor the build process.

### Provisioning Servers using OpsWorks

Once your infrastructure components have been built it's time to provision and start your actual servers! To start things up simply use:

{% highlight bash %}
admiral ow provision
{% endhighlight %}

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

{% highlight bash %}
admiral meteor push --tag TAG
{% endhighlight %}

where `TAG` is an optional git tag for this release. This will build your Meteor app locally using the correct architecture, then push it to S3. You'll have to of course create the bucket you configured above. It's recommended you also add an appropriate ACL to secure the bucket (i.e. ensure it's not public).

### Deploy your application

Finally, now that your app has been built and pushed, you can deploy it with:

{% highlight bash %}
admiral ow deploy myapp
{% endhighlight %}

where `myapp` is whatever name you specified in `ADMIRAL_DEPLOY_NAME`. By setting these values differently for different meteor apps you can deploy many different applications on the same cluster (for example using [Meteor Cluster](https://github.com/meteorhacks/cluster)).

## Typical Work-flow (after setup)

The work-flow for managing your servers with Admiral (after the initial setup) is like this:

1. Make a change to your CloudFormation template or environment JSON files.
2. Run __admiral cf update__.
3. Your template changes are validated, pushed to AWS.
4. Changes to your infrastructure are made automatically.
5. Run __admiral ow provision__ if necessary to update running instances.

 Because CloudFormation updates can cause downtime when servers are upgraded, if you have multiple servers of a given type (for example, an ElasticSearch cluster with multiple nodes) Admiral will manage creating new servers with your changes before replacing old ones. This allows you to upgrade entire clusters with zero downtime.

Uploading new Meteor builds is really easy, you'll almost always do:

{% highlight bash %}
admiral meteor push
{% endhighlight %}

followed by

{% highlight bash %}
admiral ow deploy myapp
{% endhighlight %}

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

{% highlight bash %}
admiral cf update --environment production.json --template CloudFormation.template
{% endhighlight %}

You check in your templates and JSON configurations into your source tree and can easily migrate or rollback to specific configurations.
