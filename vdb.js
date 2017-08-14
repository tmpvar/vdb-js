const BitSet = require('fast-bitset')
const ndarray = require('ndarray')

const test = require('tape')

function genPositionArgs (dimensions) {
  return Array(dimensions).fill('a').map((v, i) => String.fromCharCode(97 + i))
}
function genPositionIndex (dimensions, mask, shift) {
  const args = genPositionArgs(dimensions)

  return args.map((v) => {
    const left = shift ? `(${v} >> ${shift})` : v
    return `${left} & ${mask}`
  })
}

function nodeConfig (base, dimensions, baseSum) {
  const width = Math.pow(2, base)
  const size = Math.pow(width, dimensions)
  const mask = (1 << base) - 1

  const posArgsArray = genPositionArgs(dimensions)
  const posIndexArray = genPositionIndex(dimensions, mask, baseSum)
  return {
    base,
    width,
    size,
    mask,
    posArgsArray,
    posIndexArray,
    posArgs: posArgsArray.join(', '),
    posIndex: posIndexArray.join(', '),
    dataWidth: Array(dimensions).fill(width)
  }
}

function defCreateLeafNode (base, dimensions) {
  const c = nodeConfig(base, dimensions)
  const code = `
  const ndarraySize = [${c.dataWidth.join(', ')}]

  function createLeafNode () {
    return {
      mask: new BitSet(${c.size}),
      value: ndarray(new Float32Array(${c.size}), ndarraySize),

      set (${c.posArgs}, value) {
        const index = this.value.index(${c.posIndex})
        value ? this.mask.set(index) : this.mask.unset(index)
        this.value.data[index] = value
      },

      get (${c.posArgs}) {
        return this.value.get(${c.posIndex})
      },

      size () {
        return ${c.size}
      }
    }
  }

  createLeafNode.baseSum = ${c.base}
  return createLeafNode
  `

  return code
}

function defCreateInternalNode (base, dimensions, baseSum) {
  const c = nodeConfig(base, dimensions, baseSum)
  const code = `
  const ndarraySize = [${c.dataWidth.join(', ')}]
  const childBaseSum = ${c.base} + childCtor.baseSum

  function createInternalNode (createLeafNode) {
    return {
      mask: new BitSet(${c.size}),
      active: new BitSet(${c.size}),
      value: ndarray(Array(${c.size}), ndarraySize),

      set (${c.posArgs}, value) {
        const index = this.value.index(${c.posIndex})
        const data = this.value.data

        if (!data[index]) {
          data[index] = childCtor()
        }

        data[index].set(${c.posArgs}, value)

        value ? this.mask.set(index) : this.mask.unset(index)
      },

      get (${c.posArgs}) {
        const index = this.value.index(${c.posIndex})
        const data = this.value.data

        if (!data[index]) {
          return
        }

        return data[index].get(${c.posArgs})
      },

      size () {
        return ${c.size}
      }
    }
  }

  createInternalNode.baseSum = childBaseSum

  return createInternalNode
  `

  return code
}

function createTree (levelConfig, dimensions) {
  const leafSource = defCreateLeafNode(levelConfig.pop(), dimensions)
  const createLeafNode = (
    new Function('ndarray', 'BitSet', leafSource)
  )(ndarray, BitSet)

  var nodeCtor = createLeafNode
  for (var i = 0; i < levelConfig.length; i++) {
    var internalSource = defCreateInternalNode(
      levelConfig[i],
      dimensions,
      nodeCtor.baseSum
    )

    nodeCtor = (
      new Function('ndarray', 'BitSet', 'childCtor', internalSource)
    )(ndarray, BitSet, nodeCtor)
  }

  const c = nodeConfig(levelConfig[0], dimensions, nodeCtor.baseSum)

  const indexString = '`' + c.posArgsArray.map((a) => {
    return '${' + a + '}'
  }).join('-') + '`'

  const code = `
    return {
      nodes: new Map(),
      set (${c.posArgs}, value) {
        const index = ${indexString}
        const nodes = this.nodes

        if (!nodes[index]) {
          nodes[index] = nodeCtor()
        }

        nodes[index].set(${c.posArgs}, value)
      },
      get (${c.posArgs}, value) {
        const index = ${indexString}
        const nodes = this.nodes

        if (!nodes[index]) {
          return
        }

        return nodes[index].get(${c.posArgs})
      },
    }
  `

  const tree = (
    new Function('nodeCtor', code)
  )(nodeCtor)

  return tree
}

test('genPositionArgs', (t) => {
  t.deepEqual(genPositionArgs(1), ['a'])
  t.deepEqual(genPositionArgs(2), ['a', 'b'])
  t.deepEqual(genPositionArgs(3), ['a', 'b', 'c'])
  t.deepEqual(genPositionArgs(4), ['a', 'b', 'c', 'd'])

  t.end()
})

test('genPositionIndex', (t) => {
  t.deepEqual(genPositionIndex(1, 'mask'), ['a & mask'])
  t.deepEqual(genPositionIndex(2, 'mask'), ['a & mask', 'b & mask'])
  t.deepEqual(genPositionIndex(3, 'mask'), ['a & mask', 'b & mask', 'c & mask'])
  t.deepEqual(genPositionIndex(4, 'mask'), ['a & mask', 'b & mask', 'c & mask', 'd & mask'])

  t.end()
})

test('defCreateLeafNode (1d float)', (t) => {
  const createLeafNode1D = (new Function('ndarray', 'BitSet', defCreateLeafNode(3, 1)))(ndarray, BitSet)

  const leaf = createLeafNode1D()
  leaf.set(5, 2.50)
  t.equal(leaf.get(5), 2.5)
  t.equal(leaf.get(0), 0)
  t.equal(leaf.get(1), 0)

  t.end()
})

test('defCreateLeafNode (2d float)', (t) => {
  const createLeafNode2D = (new Function('ndarray', 'BitSet', defCreateLeafNode(3, 2)))(ndarray, BitSet)

  const leaf = createLeafNode2D()
  leaf.set(5, 2, 2.50)
  t.equal(leaf.get(5, 2), 2.5)
  t.equal(leaf.get(0, 2), 0)
  t.equal(leaf.get(0, 7), 0)

  t.end()
})

test('defCreateLeafNode (3d float)', (t) => {
  const createLeafNode2D = (new Function('ndarray', 'BitSet', defCreateLeafNode(3, 2)))(ndarray, BitSet)

  const leaf = createLeafNode2D()
  leaf.set(5, 2, 2.50)
  t.equal(leaf.get(5, 2), 2.5)
  t.equal(leaf.get(0, 2), 0)
  t.equal(leaf.get(0, 7), 0)

  t.end()
})

test('defCreateInternalNode (1d float)', (t) => {

  const createLeafNode1D = (new Function('ndarray', 'BitSet', defCreateLeafNode(3, 1)))(ndarray, BitSet)
  const createInternalNode1D = (new Function('ndarray', 'BitSet', 'childCtor', defCreateInternalNode(4, 1, createLeafNode1D.baseSum)))(ndarray, BitSet, createLeafNode1D)

  const node = createInternalNode1D()
  const data = node.value.data

  for (var i = 0; i < Math.pow(2, 4 + 3); i++) {
    node.set(i, i + 1)
    t.equal(node.get(i), i + 1)

    var idx = Math.floor(i / 8)
    t.ok(data[idx])
    t.ok(data[idx].mask.get(i % 8))
    t.notOk(data[idx].mask.get((i % 8) + 1))
  }

  node.set(1, 0.5)
  node.set(12, 0.5)

  t.equal(node.get(12), 0.5)
  t.ok(node.mask.get(0))
  t.ok(node.value.data[0].mask.get(1))
  t.ok(node.value.data[1].mask.get(4))

  t.end()
})

test.only('createTree', (t) => {
  const tree = createTree([5, 4, 3], 2)

  tree.set(4985732, 12393023, 0.5)
  t.notOk(tree.get(0, 0))
  t.equal(tree.get(4985732, 12393023), 0.5)

  t.end()
})
