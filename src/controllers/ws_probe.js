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
        // probe -> controller -> probe
        EVENT_EMIT: 'cord.workflow.ctlsvc.event.emit'
    };

    // WebSocket interface for emitting an event
    // Message format:
    // {
    //     topic: 'cord.workflow.ctlsvc.event.emit',
    //     message: {
    //         req_id: <req_id>, // optional
    //         topic: <topic>,
    //         message: <message>
    //     }
    // }
    const emitEvent = (topic, message, cb) => {
        const eventrouter = require('./eventrouter.js');

        let errorMessage;
        if(!message) {
            // error
            errorMessage = `Message body for topic ${topic} is null or empty`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('topic' in message)) {
            // error
            errorMessage = `field 'topic' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        if(!('message' in message)) {
            // error
            errorMessage = `field 'message' does not exist in message body - ${JSON.stringify(message)}`;
            logger.log('warn', `Return error - ${errorMessage}`);
            cb(errorMessage, false);
            return;
        }

        let result = eventrouter.emitEvent(
            message.topic,
            message.message
        );
        if(!result) {
            errorMessage = `failed to emit event ${message.topic} - ${message.message}`;
            cb(errorMessage, false);
        }
        else {
            cb(null, true);
        }
        return;
    };

    const getRouter = () => {
        return {
            emitEvent: {
                topic: serviceEvents.EVENT_EMIT,
                handler: emitEvent
            }
        };
    };

    module.exports = {
        serviceEvents: serviceEvents,
        getRouter: getRouter
    };
})();
