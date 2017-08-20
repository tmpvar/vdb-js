var vdb = require('./vdb')
var test = require('tape')

test('tree accessor (multiple levels)', function (t) {
  // 4096 / 128 / 8
  // n / 32 / 16
  var tree = vdb.createTree([5, 4, 3], 1)

  t.deepEqual(tree.createAccessor(4).path, [0, 0, 0, 4])
  t.deepEqual(tree.createAccessor(4097).path, [1, 0, 0, 1])

  t.end()
})

test('LeafNode: get/set', function (t) {
  const leaf = vdb.createLeafNode(3, (1 << 3) - 1)
  const v = 25.5

  leaf.set(5, v)
  t.equal(leaf.get(5), v)
  t.equal(leaf.get(0), 0)
  t.equal(leaf.get(1), 0)
  t.end()
})

test('InternalNode: set creates new child', function (t) {
  const level2 = vdb.createLeafNode.bind(null, 3)
  const level1 = vdb.createInternalNode.bind(null, 'level1', 4, 4 + 3, (1 << 4) - 1, level2)
  const level0 = vdb.createInternalNode.bind(null, 'level2', 5, 5 + 4 + 3, 0, level1)

  const node = level0()
  t.equal(node.get(0), 0)
  t.equal(node.nodes.length, Math.pow(2, 5))
  node.set(64, 552)
  t.equal(node.nodes.length, Math.pow(2, 5))
  t.equal(node.get(64), 552)

  for (var i = 0; i < 2048; i++) {
    node.set(512, i)
    t.equal(node.get(512), i)
  }
  // console.log(node.nodes[0].nodes[])

  t.equal(node.get(64), 552)
  t.end()
})

test('tree set positioning', function (t) {
  var tree = vdb.createTree([5, 4, 3], 2)

  tree.set(2056, 255)

  t.ok(tree.nodes.get(0).nodes[16])
  t.equal(tree.nodes.get(0).nodes.length, 32)
  t.notOk(tree.nodes.get(0).nodes[15])

  t.end()
})

test('tree get/set', function (t) {
  var tree = vdb.createTree([5, 4, 3], 2)

  tree.set(0, 255)
  tree.set(1, 256)
  tree.set(530000, 1337)
  tree.set(2056, 2056)

  t.equal(tree.get(9000), 0)
  t.equal(tree.get(0), 255)
  t.equal(tree.get(1), 256)
  t.equal(tree.get(530000), 1337)
  t.equal(tree.get(2056), 2056)

  t.end()
})
