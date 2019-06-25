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
  
    const argv = require('yargs').argv;
    const path = require('path');
    const YamlConfig = require('node-yaml-config');
    const logger = require('../config/logger.js');
  
    // if a config file is specified in as a CLI arguments use that one
    const cfgFile = argv.config || 'config.yml';
  
    let config;
    try {
        logger.log('debug', `Loading ${path.join(__dirname, cfgFile)}`);
        config = YamlConfig.load(path.join(__dirname, cfgFile));
        logger.log('debug', `Parsed config: ${JSON.stringify(config)}`);
    }
    catch(e) {
        logger.log('debug', `No ${cfgFile} found, using default params`);
    }
  
    module.exports = {
        service: {
            port: (config && config.service) ? config.service.port : 3000
        }
    };
})();