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
        WORKFLOW_REG: 'cord.workflow.ctlsvc.workflow.reg',
        WORKFLOW_REG_ESSENCE: 'cord.workflow.ctlsvc.workflow.reg_essence',
        WORKFLOW_LIST: 'cord.workflow.ctlsvc.workflow.list',
        WORKFLOW_RUN_LIST: 'cord.workflow.ctlsvc.workflow.run.list',
        WORKFLOW_CHECK: 'cord.workflow.ctlsvc.workflow.check',
        WORKFLOW_KICKSTART: 'cord.workflow.ctlsvc.workflow.kickstart',
        WORKFLOW_REMOVE: 'cord.workflow.ctlsvc.workflow.remove',
        WORKFLOW_RUN_REMOVE: 'cord.workflow.ctlsvc.workflow.run.remove'
    };

    // WebSocket interface for workflow registration
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.reg',
    //     message: <workflow>
    // }
    const registWorkflow = (topic, message, cb) => {
        const distributor = require('./eventrouter.js/index.js');

        let errorMessage;
        if(!message) {
            // error
            errorMessage = `Message body for topic ${topic} is null or empty`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let workflow = message;

        logger.log('debug', `workflow - ${JSON.stringify(workflow)}`);

        let result = distributor.addWorkflow(workflow);
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
    //     topic: 'cord.workflow.ctlsvc.workflow.reg',
    //     message: <workflow essence>
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

        let essence = message;
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
    //     message: null
    // }
    const listWorkflows = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let result = eventrouter.listWorkflows();
        cb(null, result);
        return;
    };

    // WebSocket interface for workflow run listing
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.list',
    //     message: null
    // }
    const listWorkflowRuns = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let result = eventrouter.listWorkflowRuns();
        cb(null, result);
        return;
    };

    // WebSocket interface for workflow check
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.check',
    //     message: <workflow_id>
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

        let workflowId = message;
        let result = eventrouter.checkWorkflow(workflowId);
        cb(null, result);
        return;
    };

    // WebSocket interface for workflow start notification
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.kickstart',
    //     message: {
    //          workflow_id: <workflow_id>,
    //          workflow_run_id: <workflow_run_id>
    //     }
    // }
    const notifyWorkflowStart = (topic, message, cb) => {
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
        eventrouter.setWorkflowRunKickstarted(workflowRunId);
        cb(null, true);
        return;
    }

    // WebSocket interface for workflow removal
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.remove',
    //     message: <workflow_id>
    // }
    const removeWorkflow = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let workflowId = message;
        let result = eventrouter.removeWorkflow(workflowId);
        cb(null, result);
        return;
    }

    // WebSocket interface for workflow run removal
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.run.remove',
    //     message: {
    //          workflow_id: <workflow_id>,
    //          workflow_run_id: <workflow_run_id>
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
    }

    const getRouter = () => {
        return {
            registWorkflow: {
                topic: serviceEvents.WORKFLOW_REG,
                handler: registWorkflow
            },
            registerWorkflowEssence: {
                topic: serviceEvents.WORKFLOW_REG_ESSENCE,
                handler: registerWorkflowEssence
            },
            listWorkflows: {
                topic: serviceEvents.WORKFLOW_LIST,
                handler: listWorkflows
            },
            listWorkflowRuns: {
                topic: serviceEvents.WORKFLOW_RUN_LIST,
                handler: listWorkflowRuns
            },
            checkWorkflow: {
                topic: serviceEvents.WORKFLOW_CHECK,
                handler: checkWorkflow
            },
            notifyWorkflowStart: {
                topic: serviceEvents.WORKFLOW_KICKSTART,
                handler: notifyWorkflowStart,
                return: false
            },
            removeWorkflow: {
                topic: serviceEvents.WORKFLOW_REMOVE,
                handler: removeWorkflow
            },
            removeWorkflowRun: {
                topic: serviceEvents.WORKFLOW_RUN_REMOVE,
                handler: removeWorkflowRun
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

    module.exports = {
        serviceEvents: serviceEvents,
        getRouter: getRouter,
        kickstartWorkflow: kickstartWorkflow
    };
})();