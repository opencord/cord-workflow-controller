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

    const socketio = require('socket.io');
    const client = require('../types/client.js');
    const eventrouter = require('./eventrouter.js');
    const logger = require('../config/logger.js');

    let io;
    const createSocketIO = (server) => {
        // INSTANTIATE SOCKET.IO
        io = socketio.listen(server, {
            pingInterval: 500,
            pingTimeout: 2000,
        });

        // set io to eventrouter
        //eventrouter.setIO(io);

        // LISTEN TO "CONNECTION" EVENT (FROM SOCKET.IO)
        io.on('connection', (socket) => {
            let query = socket.handshake.query;
            logger.log('debug', `connect ${JSON.stringify(query)}`);
            let added = false;

            // make a client
            let c = client.Client.fromObj(query);
            c.setSocket(socket);

            if(!c.validate()) {
                logger.log('warn', `client validation failed - ${JSON.stringify(query)}`);
                return;
            }

            // register the client for management
            if(eventrouter.addClient(c)) {
                // Send a greeting message to the client
                socket.emit(eventrouter.serviceEvents.GREETING, {
                    to: c.getId(),
                    message: 'Welcome to CORD Workflow Control Service'
                });

                added = true;
            }
            else {
                logger.log('warn', `client could not be added - ${JSON.stringify(query)}`);
                socket.disconnect(true);
            }

            // set a disconnect event handler
            socket.on('disconnect', (reason) => {
                logger.log('debug', `disconnect ${reason} ${JSON.stringify(query)}`);
                if(added) {
                    eventrouter.removeClient(c.getId());
                }
            });
        });
    };

    const destroySocketIO = () => {
        io.close();
    };

    const getSocketIO = () => io;

    module.exports = {
        create: createSocketIO,
        destroy: destroySocketIO,
        get: getSocketIO
    };

    // USAGE
    // const socketIo = require('./controllers/websocket.js');
    // const socket = socketIo.get();
    // socket.emit('eventName', data);

})();
