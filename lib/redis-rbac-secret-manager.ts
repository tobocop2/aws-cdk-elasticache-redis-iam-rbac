/*
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: MIT-0
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this
 * software and associated documentation files (the "Software"), to deal in the Software
 * without restriction, including without limitation the rights to use, copy, modify,
 * merge, publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
 * PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */
import cdk = require('@aws-cdk/core');
import ec2 = require('@aws-cdk/aws-ec2');
import iam = require('@aws-cdk/aws-iam');
import elasticache = require('@aws-cdk/aws-elasticache');
import lambda = require('@aws-cdk/aws-lambda');
import path = require('path');
import secretsmanager = require('@aws-cdk/aws-secretsmanager')
import fs = require('fs');


export interface RedisRbacUserProps {
  redisUserName: string;
  redisUserId: string;
  accessString?: string;
}


export class RedisRbacUser extends cdk.Construct {
  public readonly response: string;

  private rbacUserSecret: secretsmanager.Secret;
  private secretResourcePolicyStatement: iam.PolicyStatement;
  private rbacUserName: string;
  private rbacUserId: string;

  public getSecret(): secretsmanager.Secret {
    return this.rbacUserSecret
  }

  public getUserName(): string {
    return this.rbacUserName
  }

  public getUserId(): string{
    return this.rbacUserId
  }

  public grantReadSecret(principal: iam.IPrincipal){
    if (this.secretResourcePolicyStatement == null) {
      this.secretResourcePolicyStatement = new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['secretsmanager:DescribeSecret', 'secretsmanager:GetSecretValue'],
        resources: [this.rbacUserSecret.secretArn],
        principals: [principal]
      })

      this.rbacUserSecret.addToResourcePolicy(this.secretResourcePolicyStatement)

    } else {
      this.secretResourcePolicyStatement.addPrincipals(principal)
    }

    this.rbacUserSecret.grantRead(principal)
  }

  constructor(scope: cdk.Construct, id: string, props: RedisRbacUserProps) {
    super(scope, id);

    this.rbacUserId = props.redisUserId
    this.rbacUserName = props.redisUserName

    this.rbacUserSecret = new secretsmanager.Secret(this, 'secret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: props.redisUserName }),
        generateStringKey: 'password',
        excludeCharacters: '@%*()_+=`~{}|[]\\:";\'?,./'
      },
    });

    const user = new elasticache.CfnUser(this, 'redisuser', {
      engine: 'redis', //Mirus Todo: File a bug: docs say this has to be 'Redis' but 'redis' is the correct casing
      userName: props.redisUserName,
      accessString: props.accessString? props.accessString : "off +get ~keys*", // Mirus Todo: File a bug: this is required even though the docs say that it isn't -- result is 500 internal error on service ElastiCache
      userId: props.redisUserId,
      passwords: [this.rbacUserSecret.secretValueFromJson('password').toString()]
    })

    user.node.addDependency(this.rbacUserSecret)

  }

}