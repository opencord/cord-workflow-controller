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

    let serviceEvents = {
        // workflow_run -> controller -> workflow_run
        WORKFLOW_RUN_COUNT_EVENTS: 'cord.workflow.ctlsvc.workflow.run.count',
        WORKFLOW_RUN_FETCH_EVENT: 'cord.workflow.ctlsvc.workflow.run.fetch',
        // controller -> workflow_run
        WORKFLOW_RUN_NOTIFY_EVENT: 'cord.workflow.ctlsvc.workflow.run.notify'
    };

    // WebSocket interface for counting queued events
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.run.count',
    //     message: {
    //         req_id: <req_id>, // optional
    //         workflow_id: <workflow_id>,
    //         workflow_run_id: <workflow_run_id>
    //     }
    // }
    const countQueuedEvents = (topic, message, cb) => {
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
            errorMessage = `workflow_id field is not in message body - ${message}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('workflow_run_id' in message)) {
            // error
            errorMessage = `workflow_run_id field is not in message body - ${message}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let count = eventrouter.countQueuedEvents(message.workflow_run_id);
        cb(null, count);
        return;
    };

    // WebSocket interface for fetching an event
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.run.fetch',
    //     message: {
    //         req_id: <req_id>, // optional
    //         workflow_id: <workflow_id>,
    //         workflow_run_id: <workflow_run_id>,
    //         task_id: <task_id>,
    //         topic: <expected topic>
    //     }
    // }
    const fetchEvent = (topic, message, cb) => {
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
            errorMessage = `workflow_id field is not in message body - ${message}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('workflow_run_id' in message)) {
            // error
            errorMessage = `workflow_run_id field is not in message body - ${message}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('task_id' in message)) {
            // error
            errorMessage = `task_id field is not in message body - ${message}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('topic' in message)) {
            // error
            errorMessage = `topic field is not in message body - ${message}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let result = eventrouter.fetchEvent(
            message.workflow_run_id,
            message.task_id,
            message.topic
        );
        if(result) {
            // empty object {} when no message
            cb(null, result);
        }
        else {
            cb(
                `could not fetch event ${message.topic} from workflow run ${message.workflow_run_id}`,
                null
            );
        }
        return;
    };

    const getRouter = () => {
        return {
            countQueuedEvents: {
                topic: serviceEvents.WORKFLOW_RUN_COUNT_EVENTS,
                handler: countQueuedEvents
            },
            fetchEvent: {
                topic: serviceEvents.WORKFLOW_RUN_FETCH_EVENT,
                handler: fetchEvent
            }
        };
    };

    // out-going commands
    const notifyEvent = (topic) => {
        const eventrouter = require('./eventrouter.js');

        let clients = eventrouter.getWorkflowRunClients();
        _.forOwn(clients, (client, _clientId) => {
            let workflowId = client.getWorkflowId();
            let workflowRunId = client.getWorkflowRunId();

            let workflow = eventrouter.getWorkflow(workflowId);
            let workflowRun = eventrouter.getWorkflowRun(workflowRunId);
            if(workflowRun) {
                if(workflowRun.isTopicAcceptable(workflow, topic)) {
                    let socket = client.getSocket();
                    if(socket) {
                        socket.emit(serviceEvents.WORKFLOW_RUN_NOTIFY_EVENT, {
                            topic: topic
                        });
                    }
                }
            }
        });
        return;
    };

    module.exports = {
        serviceEvents: serviceEvents,
        getRouter: getRouter,
        notifyEvent: notifyEvent
    };
})();
