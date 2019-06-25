/*
 * Copyright 2019-present Open Networking Foundation

 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at

 * http://www.apache.org/licenses/LICENSE-2.0

 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */


(function () {
    'use strict';

    const _ = require('lodash');
    const logger = require('../config/logger.js');

    const ClientType = {
        PROBE: 'probe',
        WORKFLOW_MANAGER: 'workflow_manager',
        WORKFLOW_RUN: 'workflow_run',
        UNKNOWN: 'unknown'
    };

    class Client {
        constructor(id) {
            this.id = id.toLowerCase();
            // a field value can be one of followings
            // - probe : message publisher
            // - workflow_manager : workflow manager
            // - workflow_run : workflow run
            this.type = ClientType.UNKNOWN;
            // used by workflow_run
            this.workflowId = null;
            this.workflowRunId = null;
            this.socket = null;
            // optional info.
            this.params = {};
        }

        static parseClientType(strClientType) {
            if(!strClientType) {
                return ClientType.UNKNOWN;
            }
            else if(['probe', 'prb'].includes(strClientType.toLowerCase())) {
                return ClientType.PROBE;
            }
            else if(['workflow_manager', 'manager'].includes(strClientType.toLowerCase())) {
                return ClientType.WORKFLOW_MANAGER;
            }
            else if(['workflow_run', 'run'].includes(strClientType.toLowerCase())) {
                return ClientType.WORKFLOW_RUN;
            }
            else {
                return ClientType.UNKNOWN;
            }
        }

        static fromObj(obj) {
            if(obj) {
                let client;
                if('id' in obj) {
                    client = new Client(obj['id']);
                }
                else {
                    logger.log('error', 'id is not given');
                    return null;
                }

                if('type' in obj) {
                    client.setType(obj.type);
                }

                if('workflow_id' in obj) {
                    client.setWorkflowId(obj.workflow_id);
                }

                if('workflow_run_id' in obj) {
                    client.setWorkflowRunId(obj.workflow_run_id);
                }
    
                if('socket' in obj) {
                    client.setSocket(obj.socket);
                }
    
                // all others are sent to params
                client.params = {};
                _.forOwn(obj, (val, key) => {
                    client.params[key] = val;
                });
                return client;
            }
            else {
                return null;
            }
        }

        setId(id) {
            this.id = id.toLowerCase();
        }

        getId() {
            return this.id;
        }

        setType(type) {
            let clientType = Client.parseClientType(type);
            this.type = clientType;
        }

        getType() {
            return this.type;
        }

        setWorkflowId(id) {
            this.workflowId = id;
        }

        getWorkflowId() {
            return this.workflowId;
        }

        setWorkflowRunId(id) {
            this.workflowRunId = id;
        }

        getWorkflowRunId() {
            return this.workflowRunId;
        }

        setParams(params={}) {
            this.params = params;
        }

        getParams() {
            return this.params;
        }

        setSocket(socket) {
            this.socket = socket;
        }

        getSocket() {
            return this.socket;
        }

        validate() {
            // id field is required for all types of clients
            if(!this.id) {
                logger.log('error', 'id is not given');
                return false;
            }
    
            if(this.type === ClientType.UNKNOWN) {
                logger.log('error', 'type is not given properly');
                return false;
            }
    
            if(this.type === ClientType.WORKFLOW_RUN) {
                if(!this.workflowId) {
                    logger.log('error', 'workflowId is not given');
                    return false;
                }

                if(!this.workflowRunId) {
                    logger.log('error', 'workflowRunId is not given');
                    return false;
                }
            }
            return true;
        }
    }
    
    module.exports = {
        Type: ClientType,
        Client: Client
    };
})();