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
    const config = require('./config/config.js').service;
    const bodyParser = require('body-parser');
    const cors = require('cors');
    const socketIo = require('./controllers/websocket.js');
    const eventrouter = require('./controllers/eventrouter.js');
    const workflowLoader = require('./workflows/loader.js');
    const logger = require('./config/logger.js');
    const rest_probe = require('./controllers/rest_probe.js');

    const app = express();

    // Apply middlewares
    app.use(cors());
    app.use(bodyParser.json());

    // Set a router for intake interface
    app.use('/', rest_probe.getRouter());

    const startServer = (port) => {
        // if is running just return it
        if(app.server) {
            return app.server;
        }

        const server =  app.listen(port || config.port, () => {
            logger.info(`Express is listening to http://localhost:${port || config.port}`);

            // once server is ready setup WebSocket
            socketIo.create(server);

            // load built-in workflows
            let workflows = workflowLoader.loadAllWorkflows();
            for(let workflow in workflows) {
                eventrouter.addWorkflow(workflow);
            }
        });
        app.server = server;
        return server;
    };

    const stopServer = () => {
        if(app.server) {
            socketIo.destroy();
            app.server.close();
            app.server = undefined;
            eventrouter.destroy();
        }
    }

    if(!module.parent) {
        startServer();
    }

    module.exports = {
        serviceEvents: eventrouter.serviceEvents,
        app: app,
        start: startServer,
        stop: stopServer
    };
})();