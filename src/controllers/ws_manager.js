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
    const Workflow = require('../types/workflow.js');
    const logger = require('../config/logger.js');

    let serviceEvents = {
        // manager -> controller -> manager
        WORKFLOW_REGISTER: 'cord.workflow.ctlsvc.workflow.register',
        WORKFLOW_REGISTER_ESSENCE: 'cord.workflow.ctlsvc.workflow.register_essence',
        WORKFLOW_LIST: 'cord.workflow.ctlsvc.workflow.list',
        WORKFLOW_LIST_RUN: 'cord.workflow.ctlsvc.workflow.run.list',
        WORKFLOW_CHECK: 'cord.workflow.ctlsvc.workflow.check',
        WORKFLOW_REMOVE: 'cord.workflow.ctlsvc.workflow.remove',
        WORKFLOW_REMOVE_RUN: 'cord.workflow.ctlsvc.workflow.run.remove',
        WORKFLOW_REPORT_NEW_RUN: 'cord.workflow.ctlsvc.workflow.report_new_run',
        WORKFLOW_REPORT_RUN_STATUS: 'cord.workflow.ctlsvc.workflow.report_run_status',
        WORKFLOW_REPORT_RUN_STATUS_BULK: 'cord.workflow.ctlsvc.workflow.report_run_status_bulk',
        // controller -> manager
        WORKFLOW_KICKSTART: 'cord.workflow.ctlsvc.workflow.kickstart',
        WORKFLOW_CHECK_STATUS: 'cord.workflow.ctlsvc.workflow.check.status',
        WORKFLOW_CHECK_STATUS_BULK: 'cord.workflow.ctlsvc.workflow.check.status_bulk',
    };

    // WebSocket interface for workflow registration
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.reg',
    //     message: {
    //         req_id: <req_id>, // optional
    //         workflow: <workflow>
    //     }
    // }
    const registerWorkflow = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let errorMessage;
        if(!message) {
            // error
            errorMessage = `Message body for topic ${topic} is null or empty`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('workflow' in message)) {
            // error
            errorMessage = `field 'workflow' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let workflow = message.workflow;

        logger.log('debug', `workflow - ${JSON.stringify(workflow)}`);

        let result = eventrouter.addWorkflow(workflow);
        if(!result) {
            errorMessage = `failed to register a workflow ${workflow.getId()}`;
            cb(errorMessage, false);
        }
        else {
            cb(null, true);
        }
        return;
    };

    // WebSocket interface for workflow registration (via essence)
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.reg_essence',
    //     message: {
    //         req_id: <req_id> // optional
    //         essence: <workflow essence>
    //     }
    // }
    const registerWorkflowEssence = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');
        let errorMessage;
        if(!message) {
            // error
            errorMessage = `Message body for topic ${topic} is null or empty`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('essence' in message)) {
            // error
            errorMessage = `field 'essence' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let essence = message.essence;
        let result = true;
        let errorResults = [];

        logger.log('debug', `workflow essence - ${JSON.stringify(essence)}`);

        let workflows = Workflow.loadWorkflowsFromEssence(essence);
        workflows.forEach((workflow) => {
            if(workflow) {
                let localResult = eventrouter.addWorkflow(workflow);
                errorResults.push(localResult);
                result = result && localResult; // false if any of registrations fails
            }
        });

        if(!result) {
            errorMessage = `failed to register workflows ${errorResults}`;
            cb(errorMessage, false);
        }
        else {
            cb(null, true);
        }
        return;
    };

    // WebSocket interface for workflow listing
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.list',
    //     message: {
    //         req_id: <req_id> // optional
    //     }
    // }
    const listWorkflows = (_topic, _message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let result = eventrouter.listWorkflows();
        cb(null, result);
        return;
    };

    // WebSocket interface for workflow run listing
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.list',
    //     message: {
    //         req_id: <req_id> // optional
    //     }
    // }
    const listWorkflowRuns = (_topic, _message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let result = eventrouter.listWorkflowRuns();
        cb(null, result);
        return;
    };

    // WebSocket interface for workflow check
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.check',
    //     message: {
    //         req_id: <req_id> // optional
    //         workflow_id: <workflow_id>
    //     }
    // }
    const checkWorkflow = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let errorMessage;
        if(!message) {
            // error
            errorMessage = `Message body for topic ${topic} is null or empty`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('workflow_id' in message)) {
            // error
            errorMessage = `field 'workflow_id' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let workflowId = message.workflow_id;
        let result = eventrouter.checkWorkflow(workflowId);
        cb(null, result);
        return;
    };

    // WebSocket interface for workflow removal
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.remove',
    //     message: {
    //         req_id: <req_id> // optional
    //         workflow_id: <workflow_id>
    //     }
    // }
    const removeWorkflow = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let errorMessage;
        if(!message) {
            // error
            errorMessage = `Message body for topic ${topic} is null or empty`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('workflow_id' in message)) {
            // error
            errorMessage = `field 'workflow_id' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let workflowId = message.workflow_id;
        let result = eventrouter.removeWorkflow(workflowId);
        cb(null, result);
        return;
    };

    // WebSocket interface for workflow run removal
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.run.remove',
    //     message: {
    //         req_id: <req_id> // optional
    //         workflow_id: <workflow_id>,
    //         workflow_run_id: <workflow_run_id>
    //     }
    // }
    const removeWorkflowRun = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let errorMessage;
        if(!message) {
            // error
            errorMessage = `Message body for topic ${topic} is null or empty`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('workflow_id' in message)) {
            // error
            errorMessage = `field 'workflow_id' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('workflow_run_id' in message)) {
            // error
            errorMessage = `field 'workflow_run_id' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let workflowRunId = message.workflow_run_id;

        let result = eventrouter.removeWorkflowRun(workflowRunId);
        cb(null, result);
        return;
    };

    // WebSocket interface for reporting a new workflow run
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.report_new_run',
    //     message: {
    //         req_id: <req_id> // optional
    //         workflow_id: <workflow_id>,
    //         workflow_run_id: <workflow_run_id>
    //     }
    // }
    const reportNewWorkflowRun = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let errorMessage;
        if(!message) {
            // error
            errorMessage = `Message body for topic ${topic} is null or empty`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('workflow_id' in message)) {
            // error
            errorMessage = `field 'workflow_id' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('workflow_run_id' in message)) {
            // error
            errorMessage = `field 'workflow_run_id' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let workflowRunId = message.workflow_run_id;

        // there must be a workflow matching
        // set the workflow kickstarted
        let result = eventrouter.setWorkflowRunKickstarted(workflowRunId);
        cb(null, result);
        return;
    };

    // WebSocket interface for reporting workflow run status
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.report_run_status',
    //     message: {
    //         req_id: <req_id> // optional
    //         workflow_id: <workflow_id>,
    //         workflow_run_id: <workflow_run_id>,
    //         status: one of ['success', 'running', 'failed', 'unknown']
    //     }
    // }
    const reportWorkflowRunStatus = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let errorMessage;
        if(!message) {
            // error
            errorMessage = `Message body for topic ${topic} is null or empty`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('workflow_id' in message)) {
            // error
            errorMessage = `field 'workflow_id' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('workflow_run_id' in message)) {
            // error
            errorMessage = `field 'workflow_run_id' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('status' in message)) {
            // error
            errorMessage = `field 'status' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let workflowRunId = message.workflow_run_id;
        let status = message.status;

        // there must be a workflow matching
        // set workflow status
        let result = eventrouter.setWorkflowRunStatus(workflowRunId, status);
        cb(null, result);
        return;
    }

    // WebSocket interface for reporting workflow run status bulk
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.report_run_status_bulk',
    //     message: {
    //         req_id: <req_id> // optional
    //         data: [{
    //             workflow_id: <workflow_id>,
    //             workflow_run_id: <workflow_run_id>,
    //             status: one of ['success', 'running', 'failed', 'unknown']
    //         }, ...]
    //     }
    // }
    const reportWorkflowRunStatusBulk = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let errorMessage;
        if(!message) {
            // error
            errorMessage = `Message body for topic ${topic} is null or empty`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('data' in message)) {
            // error
            errorMessage = `field 'data' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let results = [];
        for(let d in message.data) {
            if(!('workflow_id' in d)) {
                // error
                errorMessage = `field 'workflow_id' does not exist in message body - ${JSON.stringify(d)}`;
                logger.log('warn', `Return error - ${errorMessage}`);
                cb(errorMessage, false);
                return;
            }

            if(!('workflow_run_id' in d)) {
                // error
                errorMessage = `field 'workflow_run_id' does not exist in message body - ${JSON.stringify(d)}`;
                logger.log('warn', `Return error - ${errorMessage}`);
                cb(errorMessage, false);
                return;
            }

            if(!('status' in d)) {
                // error
                errorMessage = `field 'status' does not exist in message body - ${JSON.stringify(d)}`;
                logger.log('warn', `Return error - ${errorMessage}`);
                cb(errorMessage, false);
                return;
            }

            let workflowRunId = d.workflow_run_id;
            let status = d.status;

            // there must be a workflow matching
            // set workflow status
            let result = eventrouter.setWorkflowRunStatus(workflowRunId, status);
            results.append(result);
        }

        cb(null, results);
        return;
    }

    const getRouter = () => {
        return {
            registerWorkflow: {
                topic: serviceEvents.WORKFLOW_REGISTER,
                handler: registerWorkflow
            },
            registerWorkflowEssence: {
                topic: serviceEvents.WORKFLOW_REGISTER_ESSENCE,
                handler: registerWorkflowEssence
            },
            listWorkflows: {
                topic: serviceEvents.WORKFLOW_LIST,
                handler: listWorkflows
            },
            listWorkflowRuns: {
                topic: serviceEvents.WORKFLOW_LIST_RUN,
                handler: listWorkflowRuns
            },
            checkWorkflow: {
                topic: serviceEvents.WORKFLOW_CHECK,
                handler: checkWorkflow
            },
            removeWorkflow: {
                topic: serviceEvents.WORKFLOW_REMOVE,
                handler: removeWorkflow
            },
            removeWorkflowRun: {
                topic: serviceEvents.WORKFLOW_REMOVE_RUN,
                handler: removeWorkflowRun
            },
            reportNewWorkflowRun: {
                topic: serviceEvents.WORKFLOW_REPORT_NEW_RUN,
                handler: reportNewWorkflowRun
            },
            reportWorkflowRunStatus: {
                topic: serviceEvents.WORKFLOW_REPORT_RUN_STATUS,
                handler: reportWorkflowRunStatus
            },
            reportWorkflowRunStatusBulk: {
                topic: serviceEvents.WORKFLOW_REPORT_RUN_STATUS_BULK,
                handler: reportWorkflowRunStatusBulk
            }
        };
    };

    // out-going commands
    const kickstartWorkflow = (workflowId, workflowRunId) => {
        const eventrouter = require('./eventrouter.js');

        let clients = eventrouter.getWorkflowManagerClients();
        _.forOwn(clients, (client, _clientId) => {
            let socket = client.getSocket();
            if(socket) {
                socket.emit(serviceEvents.WORKFLOW_KICKSTART, {
                    workflow_id: workflowId,
                    workflow_run_id: workflowRunId
                });
            }
        });
        return;
    };

    const checkWorkflowRunStatus = (workflowId, workflowRunId) => {
        const eventrouter = require('./eventrouter.js');

        let clients = eventrouter.getWorkflowManagerClients();
        _.forOwn(clients, (client, _clientId) => {
            let socket = client.getSocket();
            if(socket) {
                socket.emit(serviceEvents.WORKFLOW_CHECK_STATUS, {
                    workflow_id: workflowId,
                    workflow_run_id: workflowRunId
                });
            }
        });
        return;
    };

    const checkWorkflowRunStatusBulk = (requests) => {
        // input is an array of
        // {
        //      workflow_id: <workflowId>,
        //      workflow_run_id: <workflowRunId>
        // }
        const eventrouter = require('./eventrouter.js');

        let clients = eventrouter.getWorkflowManagerClients();
        _.forOwn(clients, (client, _clientId) => {
            let socket = client.getSocket();
            if(socket) {
                socket.emit(serviceEvents.WORKFLOW_CHECK_STATUS_BULK, requests);
            }
        });
        return;
    };

    module.exports = {
        serviceEvents: serviceEvents,
        getRouter: getRouter,
        kickstartWorkflow: kickstartWorkflow,
        checkWorkflowRunStatus: checkWorkflowRunStatus,
        checkWorkflowRunStatusBulk: checkWorkflowRunStatusBulk
    };
})();
