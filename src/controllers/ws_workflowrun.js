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

    const logger = require('../config/logger.js');

    let serviceEvents = {
        WORKFLOW_RUN_UPDATE_STATUS: 'cord.workflow.ctlsvc.workflow.run.status',
        WORKFLOW_RUN_COUNT_EVENTS: 'cord.workflow.ctlsvc.workflow.run.count',
        WORKFLOW_RUN_FETCH_EVENT: 'cord.workflow.ctlsvc.workflow.run.fetch'
    };

    // WebSocket interface for workflow status update
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.run.status',
    //     message: {
    //          workflow_id: <workflow_id>,
    //          workflow_run_id: <workflow_run_id>,
    //          task_id: <task_id>,
    //          status: 'begin' or 'end'
    //     }
    // }
    const updateWorkflowRunStatus = (topic, message, cb) => {
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

        if(!('status' in message)) {
            // error
            errorMessage = `status field is not in message body - ${message}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let result = eventrouter.updateWorkflowRunStatus(
            message.workflow_id,
            message.workflow_run_id,
            message.task_id,
            message.status.toLowerCase()
        );
        cb(null, result);
        return;
    };

    // WebSocket interface for counting queued events
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.workflow.run.count',
    //     message: {
    //          workflow_id: <workflow_id>,
    //          workflow_run_id: <workflow_run_id>
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
    //          workflow_id: <workflow_id>,
    //          workflow_run_id: <workflow_run_id>,
    //          task_id: <task_id>,
    //          topic: <expected topic>
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
            updateWorkflowRunStatus: {
                topic: serviceEvents.WORKFLOW_RUN_UPDATE_STATUS,
                handler: updateWorkflowRunStatus
            },
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

    module.exports = {
        serviceEvents: serviceEvents,
        getRouter: getRouter
    };
})();