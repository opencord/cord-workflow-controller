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
    const dateformat = require('dateformat');
    const WorkflowRunTask = require('./workflowruntask.js');
    const logger = require('../config/logger.js');

    class WorkflowRun {
        constructor(workflowId, workflowRunId) {
            // workflow run id (dag_run_id)
            this.id = workflowRunId;
            // workflow id
            this.workflowId = workflowId;

            // workflow run tasks - for storing status
            // id: task id
            // value : workflow run task obj
            this.runTasks = {};

            // storing key-field, key-value pairs for <event, workflow run> mapping
            // key: topic
            // value: [{
            //      field:
            //      value:
            // }, ...]
            this.eventKeyFieldValues = {};

            // client ids
            this.clientIds = [];

            // event queue
            // {
            //      topic: topic,
            //      message: message
            // }
            this.eventQueue = [];
            // trash bins
            // dequeued events are sent to this queue
            // for debugging
            this.trashEventQueue = [];

            this.kickstarted = false;
            this.finished = false;
        }

        static makeWorkflowRunId(workflowId) {
            let now = new Date();
            let datetimestr = dateformat(now, 'yyyymmdd_HHMMssl');
            return `${workflowId}_${datetimestr}`;
        }

        static makeNewRun(workflow) {
            let workflowId = workflow.getId();
            let workflowRunId = WorkflowRun.makeWorkflowRunId(workflowId);
            let workflowRun = new WorkflowRun(workflowId, workflowRunId);

            let tasks = workflow.getTasks();
            _.forOwn(tasks, (task, taskId) => {
                // set run tasks
                let runTask = new WorkflowRunTask.WorkflowRunTask(taskId);
                workflowRun.addRunTask(runTask);

                // set key_field / value
                workflowRun.setEventKeyFieldValue(task.getTopic(), task.getKeyField(), null); // init
            });
            return workflowRun;
        }

        setId(id) {
            this.id = id;
        }

        getId() {
            return this.id;
        }

        setWorkflowId(workflowId) {
            this.workflowId = workflowId;
        }

        getWorkflowId() {
            return this.workflowId;
        }

        addRunTask(runTask) {
            this.runTasks[runTask.getTaskId()] = runTask;
        }

        getRunTask(taskId) {
            if(taskId in this.runTasks) {
                return this.runTasks[taskId];
            }
            return undefined;
        }

        getTaskStatus(taskId) {
            return this.runTasks[taskId].getStatus();
        }

        updateTaskStatus(taskId, status) {
            let runTask = this.runTasks[taskId].getStatus();
            runTask.setStatus(status);
        }

        setEventKeyFieldValue(topic, field, value=null) {
            let keyFieldValues;
            if(!(topic in this.eventKeyFieldValues)) {
                keyFieldValues = [];
                // put a new empty array
                this.eventKeyFieldValues[topic] = keyFieldValues;
            }
            else {
                keyFieldValues = this.eventKeyFieldValues[topic];
            }

            let index = _.findIndex(keyFieldValues, (keyFieldValue) => {
                return keyFieldValue.field === field;
            });

            if(index >= 0) {
                // update
                keyFieldValues[index] = {
                    field: field,
                    value: value
                };
            }
            else {
                // push a new
                keyFieldValues.push({
                    field: field,
                    value: value
                });
            }
            return true;
        }

        isEventKeyFieldValueAcceptable(topic, field, value) {
            if(!(topic in this.eventKeyFieldValues)) {
                // topic does not exist
                return false;
            }

            let keyFieldValues = this.eventKeyFieldValues[topic];
            let index = _.findIndex(keyFieldValues, (keyFieldValue) => {
                return (keyFieldValue.field === field) &&
                    ((!keyFieldValue.value) || (keyFieldValue.value === value));
            });

            if(index >= 0) {
                return true;
            }
            return false;
        }

        isEventAcceptableByKeyFieldValue(topic, message) {
            if(!(topic in this.eventKeyFieldValues)) {
                // topic does not exist
                return false;
            }

            let keyFieldValues = this.eventKeyFieldValues[topic];
            keyFieldValues.forEach((keyFieldValue) => {
                if(keyFieldValue.field in message) {
                    // has same field in the message
                    // check value
                    if(keyFieldValue.value === message[keyFieldValue.field]) {
                        // has the same value
                        return true;
                    }
                }
            });
            return false;
        }

        getFilteredRunTasks(includes, excludes) {
            // returns tasks with filters
            let includeStatuses=[];
            let excludeStatuses=[];
            let includeAll = false;

            if(includes) {
                if(Array.isArray(includes)) {
                    // array
                    includes.forEach((include) => {
                        if(!includeStatuses.includes(include)) {
                            includeStatuses.push(include);
                        }
                    });
                }
                else {
                    includeStatuses.push(includes);
                }
            }
            else {
                // undefined or null
                // include all
                includeAll = true;
            }

            if(excludes) {
                if(Array.isArray(excludes)) {
                    // array
                    excludes.forEach((exclude) => {
                        if(!excludeStatuses.includes(exclude)) {
                            excludeStatuses.push(exclude);
                        }
                    });
                }
                else {
                    excludeStatuses.push(excludes);
                }
            }
            else {
                // in this case, nothing will be excluded
                // leave the array empty
            }

            let filteredRunTasks = [];
            _.forOwn(this.runTasks, (runTask, _runTaskId) => {
                // 'excludes' has a higher priority than 'includes'
                if(!excludes.includes(runTask.getStatus())) {
                    if(includeAll || includes.includes(runTask.getStatus())) {
                        // screen tasks that are not finished
                        filteredRunTasks.push(runTask);
                    }
                }
            });
            return filteredRunTasks;
        }

        getFilteredTopics(workflow, includes, excludes) {
            // returns topics with filters
            let filteredRunTasks = this.getFilteredRunTasks(includes, excludes);
            let filteredTopics = [];

            filteredRunTasks.forEach((runTask) => {
                let taskId = runTask.getTaskId();
                let task = workflow.getTask(taskId);
                let topic = task.getTopic();
                if(!filteredTopics.includes(topic)) {
                    filteredTopics.push(topic);
                }
            });
            return filteredTopics;
        }

        getAllTopics(workflow) {
            return this.getFilteredTopics(workflow, null, null);
        }

        getAcceptableTopics(workflow) {
            // return topics for tasks that are running or to be run in the future
            // include all tasks that are not ended
            return this.getFilteredTopics(workflow, null, [WorkflowRunTask.TaskStatus.END]);
        }

        isTopicAcceptable(workflow, topic) {
            // get topics of tasks that are not completed yet
            let filteredTopics = this.getFilteredTopics(
                workflow,
                null,
                [WorkflowRunTask.TaskStatus.END]
            );

            if(filteredTopics.includes(topic)) {
                return true;
            }
            else {
                return false;
            }
        }

        isEventAcceptable(workflow, topic, message) {
            // event is acceptable if it meets following criteria
            // 1) the workflow is currently interested in the same topic
            //      (finished tasks are not counted)
            // 2) the task's key field and value
            if(this.isTopicAcceptable(workflow, topic) &&
                this.isEventAcceptableByKeyFieldValue(topic, message)) {
                return true;
            }
            return false;
        }

        addClientId(clientId) {
            if(!this.clientIds.includes(clientId)) {
                this.clientIds.push(clientId);
            }
        }

        removeClientId(clientId) {
            _.pull(this.clientIds, clientId);
        }

        getClientIds() {
            return this.clientIds;
        }

        enqueueEvent(topic, message) {
            this.eventQueue.push({
                topic: topic,
                message: message
            });
        }

        peekEvent() {
            // if the queue is empty, this returns undefined
            if(this.eventQueue.length > 0) {
                return this.eventQueue[0];
            }
            return undefined;
        }

        dequeueEvent() {
            // if the queue is empty, this returns undefined
            if(this.eventQueue.length > 0) {
                let events = _.pullAt(this.eventQueue, [0]);

                // move to trash
                this.trashEventQueue.push(events[0]);
                return events[0];
            }
            return undefined;
        }

        peekEventByTopic(topic) {
            // if the queue is empty, this returns undefined
            let index = _.findIndex(this.eventQueue, (event) => {
                return event.topic === topic;
            });

            if(index >= 0) {
                return this.eventQueue[index];
            }
            return undefined;
        }

        dequeueEventByTopic(topic) {
            // find event by topic.
            // returns only first item in the queue
            // if the queue is empty, this returns undefined
            let index = _.findIndex(this.eventQueue, (event) => {
                return event.topic === topic;
            });

            if(index >= 0) {
                let events = _.pullAt(this.eventQueue, [index]);

                // move to trash
                this.trashEventQueue.push(events[0]);
                return events[0];
            }
            return undefined;
        }

        getTrashEvents() {
            return this.trashEventQueue;
        }

        lengthEventQueue() {
            return this.eventQueue.length;
        }

        setKickstarted() {
            this.kickstarted = true;
        }

        isKickstarted() {
            return this.kickstarted;
        }

        setFinished() {
            this.finished = true;
        }

        isFinished() {
            return this.finished;
        }

        validate() {
            if(!this.id) {
                logger.log('error', 'id is not given');
                return false;
            }

            if(!this.workflowId) {
                logger.log('error', 'workflowId is not given');
                return false;
            }

            return true;
        }
    }

    module.exports = {
        WorkflowRun: WorkflowRun
    };
})();