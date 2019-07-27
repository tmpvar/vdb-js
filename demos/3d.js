var createCamera = require('orbiter')
var mat4 = require('gl-matrix-mat4')
var vec3 = require('gl-matrix-vec3')
var vec4 = require('gl-matrix-vec4')
var center = require('ctx-translate-center')
var ctx = require('fc')(render, 1)

document.body.style.background = "#112"
var vdb = require('../vdb')
var tree = vdb([5, 4, 2], 3)
const MAX_DISTANCE = 10000
const FOV = Math.PI/4

var camera = createCamera(ctx.canvas, {
  eye: [0, 0, -4000],
  center: [0, 0, 0],
  zoomMax: 1000000,
  flipY: true
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


var sphereOffset = 64
for (var x = -1; x <=1; x++) {
  for (var y = -1; y <=1; y++) {
    for (var z = -1; z <=1; z++) {
      if (x === 0 && y === 0 && z === 0) {
        continue
      }
      fillSphere(16, [sphereOffset * x, sphereOffset * y, sphereOffset * z])
    }
  }
}


function bcolor (percent, a) {
  return `hsla(${percent * 360}, 100%, 50%, ${a || 1})`
}

var count = 0;
var frame = 0;
setInterval(() => {
  console.log("fps", frame, "splats", Math.ceil(count/frame))
  frame = 0
  count = 0
}, 1000)

var imageData;

function render() {
  frame++;
  const w = ctx.canvas.width
  const h = ctx.canvas.height
  resize(w, h)
  camera.tick()
  mat4.multiply(MVP, projection, camera.matrix)

  mat4.invert(imvp, MVP)
  ctx.clear()
  center(ctx)

  ctx.fillStyle = bcolor(0.75)
  ctx.strokeStyle = bcolor(0.79)


  /* TODO:
  - recursive AABB vs Frustum against the entire tree
  */
  if (!imageData) {
    ctx.createImageData(w, h);
    imageData.pending = new Uint8ClampedArray(w*h*4);
  }

  for (var i = 3; i<w*h*4; i+=4) {
    imageData.pending[i] = 0;
  }
  renderLevel(tree, 0.75, w, h, MVP, imageData)
  imageData.data.set(imageData.pending)
  ctx.putImageData(imageData, 0, 0)
}

function setPixel(id, x, y, r, g, b, a) {
  const off = (x + y * id.width) * 4
  id.pending[off + 0] = r
  id.pending[off + 1] = g
  id.pending[off + 2] = b
  id.pending[off + 3] = a
}

function getPixel(id, x, y, channel) {
  return id.pending[(x + y * id.width) * 4 + channel]
}

function renderLevel (parent, color, w, h, MVP, id) {
  parent.eachActive((node) => {
    var size = node.size()
    var radius = size / 2;
    vec3.add(v3scratch, node.position, vec3.set(v3scratch, radius, radius, radius))
    var d = vec3.distance(camera.eye, v3scratch)

    const terminate = radius < 1/Math.min(w, h) * d * Math.tan(FOV/2.0)
    //renderNode(node, color, w, h, MVP)

    if (terminate) {
      return
    }

    if (node.leaf) {
      renderVoxels(node, color + 0.25, MVP, id)
      return
    }

    renderLevel(node, color + 0.25, w, h, MVP, id)
  })
}

function renderNode(node, color, w, h, MVP) {
  ctx.strokeStyle = ctx.fillStyle = bcolor(color, .15)
  var pos = node.position
  var size = node.size()

  if (
    !transformPoint(octpoint[0], vec3.set(v3scratch, pos[0], pos[1], pos[2]), w, h, MVP) ||
    !transformPoint(octpoint[1], vec3.set(v3scratch, pos[0], pos[1] + size, pos[2] ), w, h, MVP) ||
    !transformPoint(octpoint[2], vec3.set(v3scratch, pos[0] + size, pos[1] + size, pos[2]), w, h, MVP) ||
    !transformPoint(octpoint[3], vec3.set(v3scratch, pos[0] + size, pos[1], pos[2]), w, h, MVP) ||
    !transformPoint(octpoint[4], vec3.set(v3scratch, pos[0], pos[1], pos[2] + size), w, h, MVP) ||
    !transformPoint(octpoint[5], vec3.set(v3scratch, pos[0], pos[1] + size, pos[2] + size), w, h, MVP) ||
    !transformPoint(octpoint[6], vec3.set(v3scratch, pos[0] + size, pos[1] + size, pos[2] + size), w, h, MVP) ||
    !transformPoint(octpoint[7], vec3.set(v3scratch, pos[0] + size, pos[1], pos[2] + size), w, h, MVP)
  ) {
    return
  }
  ctx.beginPath()
    vmove(octpoint[0])
    vline(octpoint[1])
    vline(octpoint[2])
    vline(octpoint[3])
    vline(octpoint[0])

    vmove(octpoint[4])
    vline(octpoint[5])
    vline(octpoint[6])
    vline(octpoint[7])
    vline(octpoint[4])

    lineTo(octpoint[0], octpoint[4])
    lineTo(octpoint[1], octpoint[5])
    lineTo(octpoint[3], octpoint[7])
    lineTo(octpoint[2], octpoint[6])
    ctx.stroke()
}

function renderVoxels (node, color, MVP, id) {
  const start = node.position
  ctx.fillStyle = ctx.strokeStyle = bcolor(color)
  const w = id.width
  const h = id.height
  const pos = node.position
  const shape = node.value.shape

  node.eachActive((v, i, x, y, z) => {
    vec3.set(v3scratch, pos[0] + x, pos[1] + y, pos[2] + z)
    if (!transformPoint(v3scratch, v3scratch, w, h, MVP)) {
      return
    }

    var px = (v3scratch[0] + w/2)|0
    var py = (v3scratch[1] + h/2)|0
    var pz = (255 * v3scratch[2])|0

    if (pz < getPixel(id, px, py, 3) || px < 0 || py < 0 || px >= w || py >= h) {
      return
    }

    setPixel(id, px+x, py+y, 255, 255, 255, pz)
    count++;
  })

}

function vmove(v) {
  ctx.moveTo(v[0], v[1])
}

function vline(v) {
  ctx.lineTo(v[0], v[1])
}

function lineTo(start, end) {
  ctx.moveTo(start[0], start[1])
  ctx.lineTo(end[0], end[1])
}

function transformPoint(out, pos, w, h, mvp) {
  vec4.set(v4scratch, pos[0], pos[1], pos[2], 1.0)
  vec4.transformMat4(v4scratch, v4scratch, mvp)
  if (v4scratch[3] < 0) {
    return false
  }
  out[0] = (v4scratch[0] / v4scratch[3]) * w
  out[1] = (v4scratch[1] / v4scratch[3]) * h
  out[2] = (v4scratch[2] / v4scratch[3])
  return true
}

function resize(w, h) {
  mat4.perspective(
    projection,
    FOV,
    w/h,
    0.01,
    10000
  )

  imageData = ctx.createImageData(w, h);
  imageData.pending = new Uint8ClampedArray(w*h*4);
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
