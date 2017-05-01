var ctx = require('fc')(render)
var center = require('ctx-translate-center')
var vdb = require('../vdb')
var overlap = require('interval-intersection')
var tree = vdb.createTree([5, 4, 3], 1)

// tree.set(16, 255)
// tree.set(130, 255)
// tree.set(4, 255)
// tree.set(2056, 255)
// tree.set(3056, 255)
// tree.set(6500, 255)
// tree.set(9000, 255)

for (var i =0; i<10000; i+=10) {
  tree.set(i, 1);//Math.sin(i/200) * 10 / Math.cos(i))
}

function bcolor (percent, a) {
  return `hsla(${percent * 360}, 100%, 50%, ${a || 1})`
}

var scale = .1
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
    translate -= Math.pow(scale, .1) * 5
    ctx.dirty()
  }

  if (keys[37]) {
    translate += Math.pow(scale, .1) * 5
    ctx.dirty()
  }

  if (keys[38]) {
    scale += scale * .05
    ctx.dirty()
  }

  if (keys[40]) {
    scale -= scale * .05
    ctx.dirty()
  }

  scale = Math.max(0.001, scale)
  console.clear()


  const viewingInterval = [
    (-translate + window.innerWidth * .25) / scale,
    (-translate + window.innerWidth * .75) / scale
  ]

  console.log(viewingInterval, viewingInterval[1] - viewingInterval[0])
  ctx.strokeStyle = '#444'
  ctx.strokeRect(-window.innerWidth/4, -window.innerHeight/2, window.innerWidth/2, window.innerHeight)
  ctx.scale(scale, scale)
  ctx.translate((-window.innerWidth/2 + translate) / scale, 0)

  tree.each(function (level0, start0) {
    var level0interval = [start0 * level0.size(), (start0+1) * level0.size()]
    if (!overlap(level0interval, viewingInterval)) {
      return
    }

    ctx.save()
      renderNode(start0, level0.size(), bcolor(0))
      level0.each(function (level1, start1) {
        var level1interval = [
          level0interval[0] + start1 * level1.size(),
          level0interval[0] + (start1+1) * level1.size()
        ]
        if (!overlap(level1interval, viewingInterval)) {
          return
        }
        ctx.save()
          renderNode(start1, level1.size(), bcolor(.25))
          level1.each(function (level2, start2) {

            var level2interval = [
              level1interval[0] + start2 * level2.size() - 1,
              level1interval[0] + (start2+1) * level2.size() +1
            ]

            if (!overlap(level2interval, viewingInterval)) {
              return
            }

            ctx.save()
              renderNode(start2, level2.size(), bcolor(.5))

              ctx.fillStyle = bcolor(.75)
              for (var i=0; i<8; i++) {
                ctx.translate(1, 0)
                var val = level2.get(i) ? 10 : 0;
                if (val) {
                  ctx.fillRect(0.25, -.25, .5, -7.5)
                }
              }
            ctx.restore()
          })
        ctx.restore()

      })
    ctx.restore()
  })
}

function renderNode (start, size, color) {
  ctx.translate(start * size, 0)
  ctx.strokeStyle = color
  ctx.lineWidth = 1/scale
  ctx.strokeRect(1, 0, size, -size)
}

window.addEventListener('mousewheel', function(e) {
  scale -= e.deltaY / 1000
  scale = Math.max(.001, scale)
  e.preventDefault()
  ctx.dirty()
})

window.addEventListener('mousedown', () => mouse.down = true)
window.addEventListener('mouseup', () => mouse.down = false)
window.addEventListener('mousemove', (e) => {
  if (mouse.down) {
    console.log('draw')
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
