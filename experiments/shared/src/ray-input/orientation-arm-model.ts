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

import {Euler, Math as Math2, Quaternion, Vector3} from "three";

const HEAD_ELBOW_OFFSET = new Vector3(0.155, -0.465, -0.15);
const ELBOW_WRIST_OFFSET = new Vector3(0, 0, -0.25);
const WRIST_CONTROLLER_OFFSET = new Vector3(0, 0, 0.05);
const ARM_EXTENSION_OFFSET = new Vector3(-0.08, 0.14, 0.08);

const ELBOW_BEND_RATIO = 0.4; // 40% elbow, 60% wrist.
const EXTENSION_RATIO_WEIGHT = 0.4;

const MIN_ANGULAR_SPEED = 0.61; // 35 degrees per second (in radians).

/**
 * Represents the arm model for the Daydream controller. Feed it a camera and
 * the controller. Update it on a RAF.
 */
export default class OrientationArmModel {
  private isLeftHanded: boolean;
  private controllerQ: Quaternion;
  private lastControllerQ: Quaternion;
  private headQ: Quaternion;
  private headPos: Vector3;
  private elbowPos: Vector3;
  private wristPos: Vector3;
  private time: number;
  private lastTime: number;
  rootQ: Quaternion;
  private pose: { orientation: Quaternion; position: Vector3 };

  constructor() {
    this.isLeftHanded = false;

    // Current and previous controller orientations.
    this.controllerQ = new Quaternion();
    this.lastControllerQ = new Quaternion();

    // Current and previous head orientations.
    this.headQ = new Quaternion();

    // Current head position.
    this.headPos = new Vector3();

    // Positions of other joints (mostly for debugging).
    this.elbowPos = new Vector3();
    this.wristPos = new Vector3();

    // Current and previous times the model was updated.
    this.time = null;
    this.lastTime = null;

    // Root rotation.
    this.rootQ = new Quaternion();

    // Current pose that this arm model calculates.
    this.pose = {
      orientation: new Quaternion(),
      position: new Vector3()
    };
  }

  /**
   * Methods to set controller and head pose (in world coordinates).
   */
  setControllerOrientation(quaternion) {
    this.lastControllerQ.copy(this.controllerQ);
    this.controllerQ.copy(quaternion);
  }

  setHeadOrientation(quaternion) {
    this.headQ.copy(quaternion);
  }

  setHeadPosition(position) {
    this.headPos.copy(position);
  }

  update() {
    this.time = performance.now();

    // If the controller's angular velocity is above a certain amount, we can
    // assume torso rotation and move the elbow joint relative to the
    // camera orientation.
    let headYawQ = this.getHeadYawOrientation_();
    let timeDelta = (this.time - this.lastTime) / 1000;
    let angleDelta = this.quatAngle_(this.lastControllerQ, this.controllerQ);
    let controllerAngularSpeed = angleDelta / timeDelta;
    if (controllerAngularSpeed > MIN_ANGULAR_SPEED) {
      // Attenuate the Root rotation slightly.
      this.rootQ.slerp(headYawQ, angleDelta / 10)
    } else {
      this.rootQ.copy(headYawQ);
    }

    // We want to move the elbow up and to the center as the user points the
    // controller upwards, so that they can easily see the controller and its
    // tool tips.
    let controllerEuler = new Euler().setFromQuaternion(this.controllerQ, 'YXZ');
    let controllerXDeg = Math2.radToDeg(controllerEuler.x);
    let extensionRatio = this.clamp_((controllerXDeg - 11) / (50 - 11), 0, 1);

    // Controller orientation in camera space.
    let controllerCameraQ = this.rootQ.clone().inverse();
    controllerCameraQ.multiply(this.controllerQ);

    // Calculate elbow position.
    let elbowPos = this.elbowPos;
    elbowPos.copy(this.headPos).add(HEAD_ELBOW_OFFSET);
    let elbowOffset = new Vector3().copy(ARM_EXTENSION_OFFSET);
    elbowOffset.multiplyScalar(extensionRatio);
    elbowPos.add(elbowOffset);

    // Calculate joint angles. Generally 40% of rotation applied to elbow, 60%
    // to wrist, but if controller is raised higher, more rotation comes from
    // the wrist.
    let totalAngle = this.quatAngle_(controllerCameraQ, new Quaternion());
    let totalAngleDeg = Math2.radToDeg(totalAngle);
    let lerpSuppression = 1 - Math.pow(totalAngleDeg / 180, 4); // TODO(smus): ???

    let elbowRatio = ELBOW_BEND_RATIO;
    let wristRatio = 1 - ELBOW_BEND_RATIO;
    let lerpValue = lerpSuppression *
        (elbowRatio + wristRatio * extensionRatio * EXTENSION_RATIO_WEIGHT);

    let wristQ = new Quaternion().slerp(controllerCameraQ, lerpValue);
    let invWristQ = wristQ.inverse();
    let elbowQ = controllerCameraQ.clone().multiply(invWristQ);

    // Calculate our final controller position based on all our joint rotations
    // and lengths.
    /*
    position_ =
      root_rot_ * (
        controller_root_offset_ +
2:      (arm_extension_ * amt_extension) +
1:      elbow_rot * (kControllerForearm + (wrist_rot * kControllerPosition))
      );
    */
    let wristPos = this.wristPos;
    wristPos.copy(WRIST_CONTROLLER_OFFSET);
    wristPos.applyQuaternion(wristQ);
    wristPos.add(ELBOW_WRIST_OFFSET);
    wristPos.applyQuaternion(elbowQ);
    wristPos.add(this.elbowPos);

    let offset = new Vector3().copy(ARM_EXTENSION_OFFSET);
    offset.multiplyScalar(extensionRatio);

    let position = new Vector3().copy(this.wristPos);
    position.add(offset);
    position.applyQuaternion(this.rootQ);

    let orientation = new Quaternion().copy(this.controllerQ);

    // Set the resulting pose orientation and position.
    this.pose.orientation.copy(orientation);
    this.pose.position.copy(position);

    this.lastTime = this.time;
  }

  getPose() {
    return this.pose;
  }

  /**
   * Debug methods for rendering the arm model.
   */
  getForearmLength() {
    return ELBOW_WRIST_OFFSET.length();
  }

  getElbowPosition() {
    let out = this.elbowPos.clone();
    return out.applyQuaternion(this.rootQ);
  }

  getWristPosition() {
    let out = this.wristPos.clone();
    return out.applyQuaternion(this.rootQ);
  }

  getHeadYawOrientation_() {
    let headEuler = new Euler().setFromQuaternion(this.headQ, 'YXZ');
    headEuler.x = 0;
    headEuler.z = 0;
    return new Quaternion().setFromEuler(headEuler);
  }

  clamp_(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  quatAngle_(q1, q2) {
    let vec1 = new Vector3(0, 0, -1);
    let vec2 = new Vector3(0, 0, -1);
    vec1.applyQuaternion(q1);
    vec2.applyQuaternion(q2);
    return vec1.angleTo(vec2);
  }
}
