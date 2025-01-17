/*
 * Copyright 2019 Hans Beemsterboer
 *
 * This file has been modified by Hans Beemsterboer to be used in
 * the webxr-physics project.
 *
 * Copyright 2016 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Euler, Quaternion, Math as Math2, Vector3} from 'three';
import OrientationArmModel from '../../shared/src/ray-input/orientation-arm-model';
import {GUI} from 'dat.gui';
import DaydreamSimulator from './simulator/daydream-simulator';

let simulator;
let model;
const controllerOrientation = new Quaternion();
const headOrientation = new Quaternion();
const headPosition = new Vector3(0, 1.6, 0);
let params;

function onLoad() {
  model = new OrientationArmModel();
  simulator = new DaydreamSimulator(model);

  buildGui();

  render();
}

const SimulatorParams = function () {
  this.controllerPitch = 0;
  this.controllerYaw = 0;
  this.headPitch = 0;
  this.headYaw = 0;
};

function buildGui() {
  params = new SimulatorParams();
  let gui = new GUI();
  gui.add(params, 'controllerPitch', -90, 90);
  gui.add(params, 'controllerYaw', -180, 180);
  gui.add(params, 'headPitch', -90, 90);
  gui.add(params, 'headYaw', -180, 180);
}

function render() {
  // Get simulated orientation and camera direction.
  const controllerEuler = new Euler(
    Math2.degToRad(params.controllerPitch),
    Math2.degToRad(params.controllerYaw), 0, 'YXZ');
  controllerOrientation.setFromEuler(controllerEuler);

  const headEuler = new Euler(
    Math2.degToRad(params.headPitch),
    Math2.degToRad(params.headYaw), 0, 'YXZ');
  headOrientation.setFromEuler(headEuler);

  // Feed orientation into arm model.
  model.setControllerOrientation(controllerOrientation);
  model.setHeadOrientation(headOrientation);
  model.setHeadPosition(headPosition);
  model.update();

  // Update the simulator.
  simulator.render();

  requestAnimationFrame(render);
}

window.addEventListener('load', onLoad);