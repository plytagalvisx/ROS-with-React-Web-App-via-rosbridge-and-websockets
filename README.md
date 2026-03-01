<!-- # React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project. -->

# ROS1 Burger Robot -- Web Exploration Interface (React + rosbridge)

This project connects a **ROS1 TurtleBot3 Burger simulation** (running
in Ubuntu 20.04 arm64 VM) with a **React-based web interface** (running locally on
macOS M1 Silicon) using:

- rosbridge_server
- roslibjs
- WebSockets
- React (Vite)

---

## Architecture Overview

Ubuntu VM (ROS1) ├── Gazebo ├── RViz ├── explorer.py (RRT-based
exploration) ├── collision_avoidance.py (ORM) ├── hector_mapping ├──
rosbridge_server (WebSocket :9090) └── Topics / Services / Actions ↓
WebSocket macOS (React Web App) ├── roslib (npm) ├── TF tree
reconstruction ├── Path follower controller (browser-side) └──
Visualization canvas

---

## ROS Side (Ubuntu VM)

### Start Simulation

roslaunch irob_assignment_1 simulator.launch

### Start rosbridge

roslaunch rosbridge_server rosbridge_websocket.launch

Default WebSocket: ws://`<VM_IP>`{=html}:9090

---

## Web App (macOS)

### Install

npm install

### Run

npm run dev

Open: http://localhost:5173

Make sure the WebSocket URL points to: ws://`<VM_IP>`{=html}:9090

---

## What the Web App Does

### Subscribes To

- /map
- /scan
- /best_branch
- /collision_free_control_point
- /tf
- /tf_static

### Publishes To

- /cmd_vel
- /syscommand

### Calls

- /get_setpoint (Service)
- get_next_goal (Action)

---

## Web-Based Controller Logic

The browser re-implements controller.py logic:

1.  Call get_next_goal action
2.  Receive nav_msgs/Path
3.  At 10Hz:
    - Call /get_setpoint
    - Transform setpoint → base_link using TF
    - Compute Twist (P-controller)
    - Publish /cmd_vel
4.  When path becomes empty:
    - Request new path
5.  Stop when explorer returns empty path

This creates a full Explore → Follow → Explore → Follow → Stop loop
entirely in the browser.

---

## Teleoperation (WASD)

Keyboard control publishes geometry_msgs/Twist.

Important: We publish plain JS objects instead of new ROSLIB.Message()
because the ESM build of roslib does not expose Message as a
constructor.

---

## Emergency Controls

- E-Stop → Publishes zero Twist
- Reset SLAM → Publishes "reset" to /syscommand

---

## Important Notes

### Do NOT run controller.py simultaneously

Only one node should publish /cmd_vel.

Check with: rostopic info /cmd_vel

---

## Possible Extensions

- Multi-robot support
- WebGL 3D visualization
- ROS2 compatibility
- Cloud deployment
- Map saving/loading

---

Author: TurtleBot3 Burger RRT Exploration + Web Control Interface

## Keep Learning

Rosbridge can be a useful tool for accelerating your robotics development. It brings the advantages of the web to the robotics world, helping us build zero-install user interfaces that anyone can use.

With Rosbridge, the possibilities are endless. Instead of having every teammate install the complex development environment that working with ROS usually requires, you can now use developer tools, create operator dashboards, and share data insights across your organization - all with a simple web page.
