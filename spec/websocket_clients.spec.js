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

    const path = require('path');
    const chai = require('chai');
    const expect = chai.expect;
    const sinonChai = require('sinon-chai');
    chai.use(sinonChai);
    const io = require('socket.io-client');
    const async = require('async');
    const _ = require('lodash');
    const server = require('../src/server.js');
    const port = 4000;
    const eventrouter = require('../src/controllers/eventrouter.js');
    const essenceLoader = require('../src/workflows/loader.js');
    const essenceFileName = path.join(__dirname, 'test_clients_workflow_essence.json');
    const workflowIdInEssence = 'test_clients_workflow'

    describe('Simple websocket client test', function() {

        var probeClient;
        var workflowManagerClient;
        var workflowRunClient;
        var workflowId;
        var workflowRunId;

        this.slow(5000);

        before(function() {
            // Start our server
            server.start(port);
        });

        after(function() {
            server.stop();
        });

        beforeEach(function(done) {
            let workflowCheckResults = [];
            async.series([
                (callback) => {
                    // connect a probe to the server
                    // to send events for test
                    probeClient = io.connect(`http://localhost:${port}`, {
                        query: 'id=probe_id&type=probe' +
                                '&name=probe@xos.org'
                    });

                    probeClient.on('connect', () => {
                        callback(null, true);
                    });
                    return;
                },
                (callback) => {
                    // connect a workflow manager to the server
                    // to register a test workflow
                    workflowManagerClient = io.connect(`http://localhost:${port}`, {
                        query: 'id=workflow_manager_id&type=workflow_manager' +
                                '&name=manager@xos.org'
                    });

                    workflowManagerClient.on(eventrouter.serviceEvents.WORKFLOW_KICKSTART, (message) => {
                        workflowRunId = message.workflow_run_id;

                        // call-back
                        workflowManagerClient.emit(eventrouter.serviceEvents.WORKFLOW_REPORT_NEW_RUN, {
                            workflow_id: workflowId,
                            workflow_run_id: workflowRunId
                        })
                    });

                    workflowManagerClient.on('connect', () => {
                        callback(null, true);
                    });
                    return;
                },
                (callback) => {
                    // check existance of the workflow
                    let essence = essenceLoader.loadEssence(essenceFileName, true);
                    let workflowCnt=0;

                    _.forOwn(essence, (_value, essenceWorkflowId) => {
                        workflowId = essenceWorkflowId; // preseve only the last one for test

                        workflowCnt++;

                        workflowManagerClient.emit(eventrouter.serviceEvents.WORKFLOW_CHECK, {
                            workflow_id: essenceWorkflowId
                        });

                        workflowManagerClient.on(eventrouter.serviceEvents.WORKFLOW_CHECK, (workflowCheckResult) => {
                            workflowCnt--;
                            workflowCheckResults.push(workflowCheckResult.result);

                            if(workflowCnt <= 0) {
                                callback(null, workflowCheckResults);
                            }
                        });
                    });
                    return;
                },
                (callback) => {
                    // register the workflow
                    let register = false;
                    workflowCheckResults.forEach((workflowCheckResult) => {
                        if(!workflowCheckResult) {
                            register = true;
                        }
                    });

                    if(register) {
                        let essence = essenceLoader.loadEssence(essenceFileName, true);

                        workflowManagerClient.emit(eventrouter.serviceEvents.WORKFLOW_REGISTER_ESSENCE, {
                            essence: essence
                        });

                        workflowManagerClient.on(
                            eventrouter.serviceEvents.WORKFLOW_REGISTER_ESSENCE,
                            (workflowRegResult) => {
                                callback(null, workflowRegResult);
                            }
                        );
                    }
                    else {
                        callback(null, true);
                    }
                    return;
                },
                (callback) => {
                    // kickstart the test workflow
                    probeClient.emit('onu.events', {serialNumber: 'testSerialXXX', other: 'test_other_field'});
                    setTimeout(() => {
                        expect(workflowRunId).to.not.be.undefined;
                        callback(null, true);
                    }, 1000);
                    return;
                },
                (callback) => {
                    // connect a workflow run client to the server
                    workflowRunClient = io.connect(`http://localhost:${port}`, {
                        query: 'id=workflow_run_id&type=workflow_run' +
                                `&workflow_id=${workflowIdInEssence}&workflow_run_id=${workflowRunId}` +
                                '&name=run@xos.org'
                    });

                    // when is connected start testing
                    workflowRunClient.on('connect', () => {
                        callback(null, true);
                    });
                    return;
                }
            ],
            function(err, results) {
                // we do not actually check results
                if(results.includes(false)) {
                    done.fail(err);
                }
                else {
                    done();
                }
            });
            return;
        });

        afterEach(function(done) {
            // remove workflow run
            workflowManagerClient.emit(server.serviceEvents.WORKFLOW_REMOVE_RUN, {
                workflow_id: workflowId,
                workflow_run_id: workflowRunId
            });

            // remove workflow
            workflowManagerClient.emit(server.serviceEvents.WORKFLOW_REMOVE, {
                workflow_id: workflowId
            });

            workflowId = null;
            workflowRunId = null;

            // disconnect clients
            if(workflowManagerClient.connected) {
                workflowManagerClient.disconnect();
            }
            workflowManagerClient = null;

            if(workflowRunClient.connected) {
                workflowRunClient.disconnect();
            }
            workflowRunClient = null;

            if(probeClient.connected) {
                probeClient.disconnect();
            }
            probeClient = null;

            done();
        });

        it('should have a probe, a workflow manager and a workflow run', function(done) {
            const eventrouter = require('../src/controllers/eventrouter.js');
            expect(
                Object.keys(eventrouter.getWorkflowRunClients()).length,
                'num of workflow run clients'
            ).to.equal(1);
            expect(
                Object.keys(eventrouter.getWorkflowManagerClients()).length,
                'num of workflow manager clients'
            ).to.equal(1);
            expect(
                Object.keys(eventrouter.getProbeClients()).length,
                'num of probe clients'
            ).to.equal(1);
            expect(
                Object.keys(eventrouter.getClients()).length,
                'total num of clients'
            ).to.equal(3);

            expect(
                'probe_id' in eventrouter.getClients(),
                'a client called prove_id exists'
            ).to.equal(true);
            expect(
                'workflow_manager_id' in eventrouter.getClients(),
                'a client called workflow_manager_id exists'
            ).to.equal(true);
            expect(
                'workflow_run_id' in eventrouter.getClients(),
                'a client called workflow_run_id exists'
            ).to.equal(true);
            done();
        });

        it('should store user details for a new connection', function() {
            const eventrouter = require('../src/controllers/eventrouter.js');

            const probe = eventrouter.getClients()['probe_id'];
            expect(probe.getParams().name).to.equal('probe@xos.org');

            const manager = eventrouter.getClients()['workflow_manager_id'];
            expect(manager.getParams().name).to.equal('manager@xos.org');

            const run = eventrouter.getClients()['workflow_run_id'];
            expect(run.getParams().name).to.equal('run@xos.org');
        });

        it('should not store the same user twice', function(done) {
            // This test case makes cleaning up process taking long time because it leaves
            // a client socket. It seems there's no way to release it from server-side.

            // connect a client to the server
            const client2 = io.connect(`http://localhost:${port}`, {
                query: 'id=probe_id&type=probe' +
                        '&name=probe@xos.org&value=different_value'
            });

            // when is connected start testing
            client2.on('connect', () => {
                setTimeout(() => {
                    const eventrouter = require('../src/controllers/eventrouter.js');
                    expect(
                        Object.keys(eventrouter.getWorkflowRunClients()).length,
                        'num of workflow run clients'
                    ).to.equal(1);
                    expect(
                        Object.keys(eventrouter.getWorkflowManagerClients()).length,
                        'num of workflow manager clients'
                    ).to.equal(1);
                    expect(
                        Object.keys(eventrouter.getProbeClients()).length,
                        'num of probe clients'
                    ).to.equal(1);
                    expect(
                        Object.keys(eventrouter.getClients()).length,
                        'total num of clients'
                    ).to.equal(3);

                    done();
                }, 100);
            });
        });

        it('should remove a user on disconnect', function(done) {
            workflowManagerClient.disconnect();
            workflowRunClient.disconnect();
            probeClient.disconnect();

            // we need to wait for the event to be dispatched
            setTimeout(() => {
                const eventrouter = require('../src/controllers/eventrouter.js');
                expect(
                    Object.keys(eventrouter.getWorkflowRunClients()).length,
                    'num of workflow run clients'
                ).to.equal(0);
                expect(
                    Object.keys(eventrouter.getWorkflowManagerClients()).length,
                    'num of workflow manager clients'
                ).to.equal(0);
                expect(
                    Object.keys(eventrouter.getProbeClients()).length,
                    'num of probe clients'
                ).to.equal(0);
                expect(
                    Object.keys(eventrouter.getClients()).length,
                    'total num of clients'
                ).to.equal(0);
                done();
            }, 100);
        });
    });
})();
