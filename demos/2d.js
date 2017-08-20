var ctx = require('fc')(render)
var center = require('ctx-translate-center')
var vdb = require('../vdb')
var tree = vdb([5, 4, 3], 2)

for (var i = 0; i < 100; i++) {


  // var v = (Math.abs(Math.sin(i/200) * i/10 - Math.sin(i/20) * Math.random() * 100 + Math.tan(i / 2) * i/1000)|0)
  for (var j=0; j<100; j++) {
    var v = (Math.sin(i / 100) * Math.cos(j / 100)) < 0

    tree.set(i, j, v|0)
  }

}

tree.set(0, 0, 1)
tree.set(16, 0, 1)

function bcolor (percent, a) {
  return `hsla(${percent * 360}, 100%, 50%, ${a || 1})`
}

var scale = 0.1
var translate = 0
const mouse = {
  pos: [0, 0],
  down: false
}
const keys = {}

function overlapSquare (vec, width, aabb) {
  const bottom = Math.floor(vec[1])
  const top = Math.ceil(vec[1] + width)
  const left = Math.floor(vec[0])
  const right = Math.ceil(vec[0] + width)

  return !(
    aabb[0][0] > right ||
    aabb[1][0] < left ||
    aabb[1][1] < bottom ||
    aabb[0][1] > top
  )
}

function render () {
  ctx.clear()


  if (keys[39]) {
    translate -= Math.pow(scale, 0.1) * 5
    ctx.dirty()
  }

  if (keys[37]) {
    translate += Math.pow(scale, 0.1) * 5
    ctx.dirty()
  }

  if (keys[38]) {
    scale += scale * 0.05
    ctx.dirty()
  }

  if (keys[40]) {
    scale -= scale * 0.05
    ctx.dirty()
  }

  scale = Math.max(0.001, scale)

  // const viewingBox = [
  //   [
  //     Math.floor((-translate + window.innerWidth / 4) / scale),
  //     Math.floor((-translate + window.innerHeight / 4) / scale),
  //   ],
  //   [
  //     Math.ceil((-translate + window.innerWidth * 0.75) / scale),
  //     Math.ceil((-translate + window.innerHeight * 0.75) / scale)
  //   ]
  // ]

  const viewingBoxRaw = [
    [window.innerWidth * 0.25, window.innerHeight * 0.25],
    [window.innerWidth * 0.75, window.innerHeight * 0.75]
  ]

  ctx.save()

  ctx.strokeStyle = '#444'
  ctx.strokeRect(
    viewingBoxRaw[0][0],
    viewingBoxRaw[0][1],
    viewingBoxRaw[1][0] - viewingBoxRaw[0][0],
    viewingBoxRaw[1][1] - viewingBoxRaw[0][1]
  )

  ctx.restore()
  center(ctx)
  ctx.translate(0, window.innerHeight/4)
  ctx.scale(scale, -scale)
  ctx.translate(translate, 0)


  const viewingBox = [[0, 0], [0, 0]]
  const v2scratch = [
    viewingBoxRaw[0][0] + viewingBoxRaw[1][0],
    viewingBoxRaw[0][1] + viewingBoxRaw[1][1]
  ]

  ctx.pointToWorld(viewingBox[0], viewingBoxRaw[0])
  ctx.pointToWorld(viewingBox[1], viewingBoxRaw[1])

  const vbMin = Math.min(viewingBox[0][1], viewingBox[1][1])
  const vbMax = Math.max(viewingBox[0][1], viewingBox[1][1])

  viewingBox[0][1] = vbMin
  viewingBox[1][1] = vbMax

  const root = tree.slice(
    viewingBox[0][0],
    viewingBox[0][1],
    viewingBox[1][0],
    viewingBox[1][1]
  )
  var where = 0.0

  const worldMouse = [0, 0]

  ctx.pointToWorld(worldMouse, mouse.pos)

  if (mouse.down) {
    tree.set(worldMouse[0]|0, worldMouse[1]|0, 1)
  }

  renderLevel(tree, viewingBox, 0.0)
}


function renderLevel (parent, box, color) {
  parent.each((node) => {

    if (!overlapSquare(node.position, node.size(), box)) {
      return
    }

    // TODO: terminate if node is <= 1px
    const terminate = node.size() * scale < 6
    renderNode(node, bcolor(terminate ? .75 : color), terminate)

    if (terminate) {
      return
    }

    if (node.leaf) {
      renderVoxels(node, color + 0.25)
      return
    }

    renderLevel(node, box, color + 0.25)
  })
}

function renderVoxels (node, color) {
  const start = node.position
  ctx.save()
  ctx.translate(start[0], start[1])

  ctx.fillStyle = ctx.strokeStyle = bcolor(color)
  ctx.beginPath()
  ctx.lineWidth = .11

  const shape = node.value.shape
  for (var x = 0; x < shape[0]; x++) {
    for (var y = 0; y < shape[1]; y++) {
      if (!node.value.get(x, y)) continue
      // TODO: ensure voxel is inside viewing box
      ctx.fillRect(x, y, 1, 1)
    }
  }
  ctx.restore()
}

function renderNode (node, color, fill) {
  const start = node.position
  const size = node.size()
  ctx.save()
  ctx.translate(start[0], start[1])
  ctx.strokeStyle = ctx.fillStyle = color
  ctx.lineWidth = 1 / scale
  fill
  ? ctx.fillRect(0, 0, size, size)
  : ctx.strokeRect(0, 0, size, size)
  ctx.restore()
}

window.addEventListener('mousewheel', (e) => {
  scale -= e.deltaY / 1000
  scale = Math.max(0.001, scale)
  e.preventDefault()
  ctx.dirty()
})

window.addEventListener('mousedown', () => { mouse.down = true; ctx.dirty() })
window.addEventListener('mouseup', () => { mouse.down = false })
window.addEventListener('mousemove', (e) => {
  mouse.pos[0] = e.clientX
  mouse.pos[1] = e.clientY
  if (mouse.down) {
    ctx.dirty()
  }
})

window.addEventListener('keydown', (e) => {
  keys[e.keyCode] = true
  ctx.dirty()
})

window.addEventListener('keyup', (e) => {
  keys[e.keyCode] = false
  ctx.dirty()
})
