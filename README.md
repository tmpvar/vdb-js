# vdb-js

An implementation of [openvdb](http://www.openvdb.org/) in javascript.

The c++ version is nearly impossible to build on every platform, so my goal here is to prove out an implementation in JS.

## demos

```
git clone https://github.com/tmpvar/vdb-js
cd vdb-js
npm install
```

### 1D

```
npm run demos-1d
```

![1d-vdb-js](https://user-images.githubusercontent.com/46673/29499513-54918724-85e1-11e7-9a57-bb2b7d86411f.gif)

Use the arrow keys to zoom / pan. Data can be modified by clicking the mouse


### 2D

```
npm run demos-2d
```

![2d-vdb-js](https://user-images.githubusercontent.com/46673/29499541-ba8b8e3a-85e1-11e7-81e2-801a54e467dc.gif)

Use the arrow keys to zoom / pan. Data can be modified by clicking the mouse

### 3D

```
npm run demos-3d
```

![3d-vdb-js](![vdbjs-3d](https://user-images.githubusercontent.com/46673/44068048-0e8ab4f6-9f2d-11e8-80ef-ec00a46fc81c.gif)

Use the mouse to control the orbit camera: drag to orient and scroll to zoom
