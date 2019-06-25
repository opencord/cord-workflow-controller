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

    const express = require('express');
    const {checkSchema, validationResult} = require('express-validator');
    const logger = require('../config/logger.js');
    const eventrouter = require('./eventrouter.js');

    // HTTP REST interface for message intake
    // POST method
    // Message format:
    // {
    //     topic: 'topic here',
    //     message: 'message body here'
    // }
    // e.g., /intake?topic=aaa&message=bbb
    const intakeMessageInputValidator = {
        topic: {
            in: ['params', 'query'],
            errorMessage: 'Message topic is null or empty',
        },
        message: {
            in: ['params', 'query'],
            errorMessage: 'Message body is null or empty',
        }
    };

    const intakeMessage = (req, res) => {
        let errors = validationResult(req);
        if(!errors.isEmpty()) {
            res.status(400).send(
                JSON.stringify({
                    errors: errors.array()
                })
            );
            return;
        }

        let jsonMessage = req.body
        logger.debug(`Received a message ${jsonMessage}`);

        // send the message to the event distributor
        eventrouter.sendEvent(jsonMessage.topic, jsonMessage.message);

        res.status(200).send({
            result: true
        });
        return;
    };

    const getRouter = () => {
        var routerInstance = new express.Router();
        routerInstance.use((req, res, next) => {
            logger.info(`[REQ] ${req.method}, ${req.url}`);
            next();
        });

        // intake apis
        routerInstance.post('/intake', checkSchema(intakeMessageInputValidator), intakeMessage);
        return routerInstance;
    };

    module.exports = {
        getRouter: getRouter
    };
})();