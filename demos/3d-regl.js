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
const FOV = Math.PI/4

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
for (var x = -1; x <=1; x++) {
  for (var y = -1; y <=1; y++) {
    for (var z = -1; z <=1; z++) {
      if (x === 0 && y === 0 && z === 0) {
        continue
      }
      fillSphere(64, [sphereOffset * x, sphereOffset * y, sphereOffset * z])
    }
  }
}

function render() {
  camera.tick()

  regl.clear({
    depth: true,
    color: [0, 0, 0, 1]
  })

  renderLevel(tree, 0.75, gl.canvas.width, gl.canvas.height, MVP)
}

function renderLevel (parent, w, h, color) {
  parent.eachActive((node) => {
    var size = node.size()
    var radius = size / 2;
    vec3.add(v3scratch, node.position, vec3.set(v3scratch, radius, radius, radius))
    var d = vec3.distance(camera.eye, v3scratch)

    const terminate = false//size < 1/Math.min(w, h) * d * 1/Math.tan(FOV/2.0)
    //renderNode(node, color, w, h, MVP)

    if (terminate) {
      return renderNode(node, color, w, h, MVP)
    }

    if (node.leaf) {
      renderVoxels(node, color + 0.25, w, h, MVP)
      return
    }

    renderLevel(node, color + 0.25, w, h, MVP)
  })
}

const renderNodeLines = regl({
  frag: `
    precision mediump float;
    uniform vec4 color;
    void main() {
      gl_FragColor = vec4(1.0, 0.0, 1.0, 1.0);
    }`,

  vert: `
    precision mediump float;
    uniform mat4 mvp;
    uniform vec3 corner;
    uniform float size;
    varying vec3 position;

    void main () {
      gl_PointSize = 3.0;
      gl_Position = mvp * vec4(position * size / 2.0 + corner, 1);
    }
  `,

  uniforms: {
    corner: regl.prop('corner'),
    size: regl.prop('size'),
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
    position: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 0],
      [0, 1, 1],
      [1, 0, 0],
      [1, 0, 1],
      [1, 1, 0],
      [1, 1, 1]
    ]
  },
  primitive: 'points',
  lineWidth: Math.min(regl.limits.lineWidthDims[1], 3),
  count: 12
})


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
    uniform vec3 corner;
    varying vec3 position;

    void main () {
      gl_PointSize = 3.0;
      gl_Position = mvp * vec4(position + corner, 1);
    }
  `,

  uniforms: {
    corner: regl.prop('corner'),
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
  count: regl.prop('primitiveCount')
})

function renderVoxels(node, color, w, h, MVP) {

  if (!node.cachedPositionBuffer) {
    var data = []
    node.eachActive((v, i, x, y, z) => {
      data.push([x, y, z])
    })
    node.cachedPositionBuffer = regl.buffer(data)
  }

  renderSplats({
    position: node.cachedPositionBuffer,
    corner: node.position,
    primitiveCount: node.cachedPositionBuffer.length
  })
}

function renderNode(node, color, w, h, MVP) {
  renderNodeLines({
    corner: node.position,
    size: 1000,
    mvp: MVP
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
