var ctx = require('fc')(render)
var center = require('ctx-translate-center')
var vdb = require('../vdb')
var overlap = require('interval-intersection')
var tree = vdb([5, 4, 3], 1)

for (var i = 0; i < 14000; i++) {
  tree.set(i, -Math.abs(Math.sin(i/200) * i/10 - Math.sin(i/20) * Math.random() * 100 + Math.tan(i / 2) * i/1000))
}

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

function render () {
  ctx.clear()
  center(ctx)

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

  const viewingInterval = [
    Math.floor((-translate + window.innerWidth * 0.25) / scale),
    Math.ceil((-translate + window.innerWidth * 0.75) / scale)
  ]

  ctx.strokeStyle = '#444'
  ctx.strokeRect(
    -window.innerWidth / 4,
    -window.innerHeight / 2,
    window.innerWidth / 2,
    window.innerHeight
  )

  ctx.translate(0, window.innerHeight / 2 - 20)
  ctx.scale(scale, scale)
  ctx.translate((-window.innerWidth / 2 + translate) / scale, 0)

  const root = tree.slice(viewingInterval[0], viewingInterval[1])
  var where = 0.0

  const worldMouse = [0, 0]

  ctx.pointToWorld(worldMouse, mouse.pos)

  if (mouse.down) {
    tree.set(worldMouse[0]|0, worldMouse[1])
  }

  renderLevel(root, viewingInterval, 0.0)
}

function renderLevel (parent, viewingInterval, color) {
  parent.each((node) => {
    const start = node.position[0]
    var interval = [
      start,
      start + node.size()
    ]

    if (!overlap(interval, viewingInterval)) {
      return
    }

    ctx.save()
      renderNodeBracket(start, node.size(), bcolor(color))
    ctx.restore()

    if (node.leaf) {
      ctx.save()
      ctx.translate(start, 0)
        renderVoxels(node, color + 0.25)
      ctx.restore()
      return
    }



    renderLevel(node, viewingInterval, color + 0.25)
  })
}

function renderVoxels (node, color) {
  // ctx.translate(position, 0)
  ctx.strokeStyle = bcolor(color)
  ctx.beginPath()
  ctx.lineWidth = 1
  node.each((voxel, i) => {
    ctx.moveTo(i, 0)
    ctx.lineTo(i, voxel)
  })
  ctx.stroke()
}

function renderNodeBracket (start, size, color) {
  ctx.translate(start, 0)
  ctx.strokeStyle = color
  ctx.lineWidth = 1 / scale
  ctx.beginPath()
  ctx.moveTo(0, -300)
  ctx.lineTo(0, 0)
  ctx.lineTo(size, 0)
  ctx.lineTo(size, -300)
  // ctx.strokeRect(1, 0, size, -size)
  ctx.stroke()
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
