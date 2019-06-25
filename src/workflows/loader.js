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
    const fs = require('fs');
    const _ = require('lodash');
    const Workflow = require('../types/workflow.js');
    const logger = require('../config/logger.js');

    const loadEssence = (essenceFilename, absPath=false) => {
        let filepath;
        if(!absPath) {
            filepath = path.join(__dirname, essenceFilename);
        }
        else {
            filepath = essenceFilename;
        }

        try {
            if (fs.existsSync(filepath)) {
                logger.log('debug', `Loading an essence - ${filepath}`);
                let rawdata = fs.readFileSync(filepath);
                let essence = null;
                try {
                    essence = JSON.parse(rawdata);
                }
                catch (objError) {
                    if (objError instanceof SyntaxError) {
                        logger.log('warn', `failed to parse a json data (syntax error) - ${rawdata}`);
                    }
                    else {
                        logger.log('warn', `failed to parse a json data - ${rawdata}`);
                    }
                }
                return essence;
            }
            else {
                logger.log('warn', `No ${filepath} found`);
                return null;
            }
        }
        catch(e) {
            logger.log('warn', `Cannot read ${filepath} - ${e}`);
            return null;
        }
    };

    const loadWorkflows = (essenceFilename) => {
        let filepath = path.join(__dirname, essenceFilename);

        try {
            if (fs.existsSync(filepath)) {
                logger.log('debug', `Loading an essence - ${filepath}`);
                let rawdata = fs.readFileSync(filepath);
                let workflows = [];

                try {
                    let essence = JSON.parse(rawdata);

                    // an essence can have multiple workflows
                    _.forOwn(essence, (workflowEssence, workflowId) => {
                        let workflow = Workflow.Workflow.fromEssence(workflowEssence);
                        if(workflow) {
                            workflows.push(workflow);
                            logger.log('debug', `Loaded workflow: ${workflowId}`);
                        }
                    });
                }
                catch (objError) {
                    if (objError instanceof SyntaxError) {
                        logger.log('warn', `failed to parse a json data (syntax error) - ${rawdata}`);
                    }
                    else {
                        logger.log('warn', `failed to parse a json data - ${rawdata}`);
                    }
                }

                return workflows
            }
            else {
                logger.log('warn', `No ${filepath} found`);
                return null;
            }
        }
        catch(e) {
            logger.log('warn', `Cannot read ${filepath} - ${e}`);
            return null;
        }
    };

    const loadAllWorkflows = () => {
        let dirpath = __dirname;

        let allWorkflows = [];
        let dirEntries = fs.readdirSync(dirpath);
        dirEntries.forEach((dirEntry) => {
            if(dirEntry.endsWith('.json')) {
                // found workflow essence file in json format
                let workflows = loadWorkflows(dirEntry);
                if(workflows) {
                    for(let workflow in workflows) {
                        allWorkflows.push[workflow];
                    }
                }
            }
        });
        return allWorkflows;
    };

    module.exports = {
        loadEssence: loadEssence,
        loadAllWorkflows: loadAllWorkflows,
        loadWorkflows: loadWorkflows
    };
})();