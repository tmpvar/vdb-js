var createCamera = require('orbiter')
var mat4 = require('gl-matrix-mat4')
var vec3 = require('gl-matrix-vec3')
var vec4 = require('gl-matrix-vec4')
var regl = require('regl')()
regl.frame(render)
var gl = regl._gl

var vdb = require('../vdb')
var tree = vdb([5, 4, 2], 3)
const MAX_DISTANCE = 10000
const FOV = Math.PI/2

var camera = createCamera(gl.canvas, {
  eye: [0, 0, -100],
  center: [0, 0, 0],
  zoomMax: 1000000,
})

var projection = mat4.create()
var MVP = mat4.create()
var v3scratch = vec3.create()
var v4scratch = vec4.create()
var imvp = mat4.create()
var pos = vec3.create()

var octpoint = [
  vec3.create(),
  vec3.create(),
  vec3.create(),
  vec3.create(),
  vec3.create(),
  vec3.create(),
  vec3.create(),
  vec3.create()
]

var sphereOffset = 128
var r = 4
for (var x = -r; x <=r; x++) {
  for (var y = -r; y <=r; y++) {
    for (var z = -r; z <=r; z++) {
      fillSphere(16, [sphereOffset * x, sphereOffset * y, sphereOffset * z])
    }
  }
}

var splatBuffer
const splatData = []

const renderSplats = regl({
  frag: `
    precision mediump float;
    uniform vec4 color;
    void main() {
      gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
    }`,

  vert: `
    precision mediump float;
    uniform mat4 mvp;
    attribute vec3 position;

    void main () {
      gl_PointSize = 3.0;
      gl_Position = mvp * vec4(position, 1);
    }
  `,

  uniforms: {
      mvp: ({viewportWidth, viewportHeight}) => {
      mat4.perspective(
        projection,
        Math.PI / 2,
        viewportWidth / viewportHeight,
        0.01,
        100000
      )
      mat4.multiply(MVP, projection, camera.matrix)
      return MVP
    }
  },

  attributes: {
    position: regl.prop('position')
  },
  primitive: 'points',
  count: regl.prop('primitiveCount'),
})

function render() {
  camera.tick()

  regl.clear({
    depth: true,
    color: [0, 0, 0, 1]
  })

  if (!splatBuffer) {
    renderLevel(tree, 0.75, gl.canvas.width, gl.canvas.height, MVP, splatData)
    splatBuffer = regl.buffer(splatData)
  }

  renderSplats({
    position: splatBuffer,
    primitiveCount: splatData.length / 3
  })
}

function renderLevel (parent, w, h, color, MVP, data) {
  parent.eachActive((node) => {
    var size = node.size()
    var radius = size / 2;
    vec3.add(v3scratch, node.position, vec3.set(v3scratch, radius, radius, radius))
    var d = vec3.distance(camera.eye, v3scratch)

    const terminate = false//size < 1/Math.min(w, h) * d * 1/Math.tan(FOV/2.0)

    if (terminate) {
      return;
    }

    if (node.leaf) {
      renderVoxels(node, color + 0.25, w, h, MVP, data)
      return
    }

    renderLevel(node, w, h, color + 0.25, MVP, data)
  })
}

function renderVoxels(node, color, w, h, MVP, data) {
  node.eachActive((v, i, x, y, z) => {
    data.push(node.position[0] + x)
    data.push(node.position[1] + y)
    data.push(node.position[2] + z)
  })
}

function fillSphere(radius, pos) {
  var px = 0
  var py = 0

  for  (var x=-radius; x<radius; x++) {
    v3scratch[0] = x
    px = pos[0] + x
    for  (var y=-radius; y<radius; y++) {
      v3scratch[1] = y
      py = pos[1] + y
      for  (var z=-radius; z<radius; z++) {
        v3scratch[2] = z
        var v = vec3.length(v3scratch) - radius
        var active = v <= 0.0 && v > -1.0
        tree.set(
          px,
          py,
          pos[2] + z,
          v,
          active
        )
      }
    }
  }
}
