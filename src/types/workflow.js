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
    const WorkflowTask = require('./workflowtask.js');
    const logger = require('../config/logger.js');

    const loadWorkflowsFromEssence = (essence) => {
        // an essence can have multiple workflows
        let workflows = [];
        _.forOwn(essence, (workflowEssence, _workflowId) => {
            let workflow = Workflow.fromEssence(workflowEssence);
            if(workflow) {
                workflows.push(workflow);
            }
        });
        return workflows;
    };

    class Workflow {
        constructor(id) {
            // dag_id
            this.id = id;

            // key: topic
            // value: an array of WorkflowTask objects
            this.topics = {};

            // key: task id
            // value: WorkflowTask object
            this.tasks = {};

            // preserve raw essense
            this.essence = {};
        }

        static fromEssence(essence) {
            if(essence) {
                let workflow;
                if('dag' in essence) {
                    let dag = essence.dag;
                    if('dag_id' in dag) {
                        workflow = new Workflow(dag.dag_id);
                    }
                    else {
                        logger.log('error', 'dag is not given');
                        return null;
                    }
                }
                else {
                    logger.log('error', 'dag is not given');
                    return null;
                }

                // read this to detect kickstart events
                // use map for fast look up
                let headTasks = {};
                if('dependencies' in essence) {
                    let dependencies = essence.dependencies;
                    _.forOwn(dependencies, (dependency, taskId) => {
                        // if the task does not have parents, it means the head task.
                        if(!('parents' in dependency)) {
                            // kickstart task
                            headTasks[taskId] = true;
                        }
                        else {
                            if(!dependency['parents'] || dependency['parents'].length === 0) {
                                // empty array
                                // kickstart task
                                headTasks[taskId] = true;
                            }
                        }
                    });
                }

                if('tasks' in essence) {
                    let tasks = essence.tasks;
                    _.forOwn(tasks, (taskEssence, _taskId) => {
                        let task = WorkflowTask.WorkflowTask.fromEssence(taskEssence);

                        // if its in head tasks, it has a kickstart event.
                        if(task.getId() in headTasks) {
                            task.setKickstart(true);
                        }

                        workflow.addTask(task);
                    });
                }

                workflow.essence = essence;
                return workflow;
            }
            return undefined;
        }

        setId(id) {
            this.id = id;
        }

        getId() {
            return this.id;
        }

        getTopics() {
            let allTopics = [];
            _.forOwn(this.topics, (_tasks, topic) => {
                // value is an array
                if(!allTopics.includes(topic)) {
                    allTopics.push(topic);
                }
            });
            return allTopics;
        }

        getTasksForTopic(topic) {
            if(topic in this.topics) {
                let workflowTasks = this.topics[topic];
                return workflowTasks;
            }
            return undefined;
        }

        hasTasksForTopic(topic) {
            if(topic in this.topics) {
                return true;
            }
            return false;
        }

        getTasks() {
            return this.tasks;
        }

        getTask(id) {
            if(id in this.tasks) {
                let workflowTask = this.tasks[id];
                return workflowTask;
            }
            return undefined;
        }

        getKickstartTopics() {
            let kickstartTopics = [];
            _.forOwn(this.tasks, (task, _taskId) => {
                if(task.isKickstart()) {
                    let topic = task.getTopic();
                    if(!kickstartTopics.includes(topic)) {
                        kickstartTopics.push(topic);
                    }
                }
            });
            return kickstartTopics;
        }

        isKickstartTopic(topic) {
            let kickstartTopics = this.getKickstartTopics();
            if(kickstartTopics.includes(topic)) {
                return true;
            }
            return false;
        }

        addTask(task) {
            let taskId = task.getId();
            if(taskId in this.tasks) {
                logger.log('warn', `there exists a task with the same id - ${JSON.stringify(task)}`);
                return false;
            }

            this.tasks[taskId] = task;

            let taskTopic = task.getTopic();
            if(taskTopic in this.topics) {
                this.topics[taskTopic].push(task);
            }
            else {
                this.topics[taskTopic] = [task];
            }
            return true;
        }

        setEssence(essence) {
            this.essence = essence;
        }

        getEssence() {
            return this.essence;
        }

        validate() {
            if(!this.id) {
                logger.log('error', 'id is not given');
                return false;
            }

            if(!this.tasks || Object.keys(this.tasks).length > 0) {
                logger.log('error', 'task is not given');
                return false;
            }

            let countKickstartEvent = 0;
            _.forOwn(this.tasks, (task, _taskId) => {
                if(task.isKickstart()) {
                    countKickstartEvent++;
                }
            });

            if(countKickstartEvent <= 0) {
                logger.log('error', 'kickstart event is not given');
                return false;
            }
            return true;
        }
    }

    module.exports = {
        Workflow: Workflow,
        loadWorkflowsFromEssence: loadWorkflowsFromEssence
    };
})();