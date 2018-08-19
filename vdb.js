const BitSet = require('fast-bitset')
const ndarray = require('ndarray')
var a = ndarray(new Float32Array(27), [3, 3, 3])

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
  const aggregateWidth = Math.pow(2, base + baseSum)
  const size = Math.pow(width, dimensions)
  const mask = (1 << base) - 1

  const posArgsArray = genPositionArgs(dimensions)
  const posIndexArray = genPositionIndex(dimensions, mask, baseSum)
  return {
    base,
    width,
    aggregateWidth,
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

  function createLeafNode (position) {
    return {
      position: position.map((a) => (a >> ${base}) << ${base}),
      mask: new BitSet(${c.size}),
      active: new BitSet(${c.size}),
      activeCount: 0,
      leaf: true,
      // TODO: don't assume the user wants the array filled with 1
      value: ndarray(new Float32Array(${c.size}), ndarraySize),

      set (${c.posArgs}, value, active) {
        const index = this.value.index(${c.posIndex})
        this.mask.set(index)
        this.value.data[index] = value


        var currentlyActive = this.active.get(index)
        if (active) {
          if (!currentlyActive) {
            this.activeCount++
            this.active.set(index)
          }
        } else {
          if (currentlyActive) {
            this.activeCount--
            this.active.unset(index)
          }
        }
      },

      get (${c.posArgs}) {
        return this.value.get(${c.posIndex})
      },

      size () {
        return ${c.width}
      },

      isActive() {
        return this.activeCount > 0
      },

      eachActive (fn) {
        const a = this.value
        const nodes = a.data

        var i = this.active.ffs()
        while (i !== -1) {
          // TODO: optimize this
          var x = Math.floor(i / a.stride[0]) % a.shape[0]
          var y = Math.floor(i / a.stride[1]) % a.shape[1]
          var z = i % a.shape[2]

          fn(nodes[i], i, x, y, z)
          i = this.active.nextSetBit(i+1)
        }
      },

      each (fn) {
        const nodes = this.value.data
        var i = this.mask.ffs()
        while (i !== -1) {
          fn(nodes[i], i)
          i = this.mask.nextSetBit(i+1)
        }
      },
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
  const size = Math.pow(2, childBaseSum)

  function createInternalNode (position) {
    // TODO: generate less garbage w.r.t. position.map
    return {
      position: position.map((a) => (a >> childBaseSum) << childBaseSum),
      mask: new BitSet(${c.size}),
      active: new BitSet(${c.size}),
      activeCount: 0,
      value: ndarray(Array(${c.size}), ndarraySize),

      set (${c.posArgs}, value, active) {
        const index = this.value.index(${c.posIndex})
        const data = this.value.data

        if (!data[index]) {
          data[index] = childCtor([${c.posArgs}])
        }

        this.mask.set(index)

        var currentlyActive = this.active.get(index)
        if (active) {
          if (!currentlyActive) {
            this.activeCount++
          }

          this.active.set(index)
        }

        data[index].set(${c.posArgs}, value, active)

        // Wait until after we've applied the active state to the child before removing any
        // active bits. Each one of our active bits represents a rolled up view for all of
        // our child nodes. If we blindly remove the active bit for this index we will likely
        // orphan a bunch of active grandchild nodes.
        if (!data[index].isActive()) {
          if (currentlyActive) {
            this.activeCount--
          }
          this.active.unset(index)
        }
      },

      isActive() {
        return this.activeCount > 0
      },

      get (${c.posArgs}) {
        const index = this.value.index(${c.posIndex})
        const data = this.value.data

        if (!data[index]) {
          return
        }

        return data[index].get(${c.posArgs})
      },

      eachActive (fn) {
        const nodes = this.value.data
        var i = this.active.ffs()
        while (i !== -1) {
          fn(nodes[i], i)
          i = this.active.nextSetBit(i+1)
        }
      },

      each (fn) {
        const nodes = this.value.data
        var i = this.mask.ffs()
        while (i !== -1) {
          fn(nodes[i], i)
          i = this.mask.nextSetBit(i+1)
        }
      },

      size () {
        return size
      }
    }
  }

  createInternalNode.baseSum = childBaseSum

  return createInternalNode
  `

  return code
}

module.exports = createTree

function createTree (levelConfig, dimensions) {
  const nodeCtors = []

  for (var i = 0; i < levelConfig.length; i++) {
    let base = levelConfig[levelConfig.length - (i + 1)]

    if (i === 0) {
      let leafSource = defCreateLeafNode(base, dimensions)
      nodeCtors.unshift((
        new Function('ndarray', 'BitSet', leafSource)
      )(ndarray, BitSet))
    } else {
      let previousCtor = nodeCtors[0]
      let internalSource = defCreateInternalNode(
        base,
        dimensions,
        previousCtor.baseSum
      )
      nodeCtors.unshift((
        new Function('ndarray', 'BitSet', 'childCtor', internalSource)
      )(ndarray, BitSet, previousCtor))
    }
  }

  const nodeCtor = nodeCtors[0]
  const c = nodeConfig(levelConfig[0], dimensions, nodeCtor.baseSum)
  const baseSum = nodeCtor.baseSum

  const indexString = '`' + c.posArgsArray.map((a) => {
    return '${' + a + `>> ${baseSum}}`
  }).join('-') + '`'

  // slice
  const indexStringInLoop = '`' + c.posArgsArray.map((a) => {
    return '${i' + a + '}'
  }).join('-') + '`'

  const upperBoundArgsArray = c.posArgsArray.map((a) => {
    return `${a}Upper`
  })

  const lowerBoundsClamped = c.posArgsArray.map((a) => {
    return `const ${a}lb = ${a} >> ${baseSum}`
  })

  const upperBoundsClamped = c.posArgsArray.map((a) => {
    return `const ${a}ub = ${a}Upper >> ${baseSum}`
  })

  const forLoops = c.posArgsArray.map((a) => {
    return `for (var i${a} = ${a}lb; i${a} <= ${a}ub; i${a}++) {`
  })

  const forLoopsEnd = c.posArgsArray.map((a) => {
    return `}`
  })

  const upperBoundArgs = upperBoundArgsArray.join(', ')

  const code = `
    return {
      nodes: new Map(),
      set (${c.posArgs}, value, active) {
        const index = ${indexString}
        const nodes = this.nodes

        if (!nodes.has(index)) {
          nodes.set(index, nodeCtor([${c.posArgs}]))
        }

        nodes.get(index).set(${c.posArgs}, value, active)
      },
      get (${c.posArgs}, value) {
        const index = ${indexString}
        const nodes = this.nodes

        if (!nodes.has(index)) {
          return
        }

        return nodes.get(index).get(${c.posArgs})
      },
      isActive() {
        return true
      },
      slice (${c.posArgs}, ${upperBoundArgs}) {
        // TODO: until a better storage algorithm is employed,
        //       generate string indicies
        const nodes = this.nodes
        ${lowerBoundsClamped.join('\n        ')}
        ${upperBoundsClamped.join('\n        ')}

        const out = treeCtor()
        ${forLoops.join('\n        ')}
          let key = ${indexStringInLoop}
          if (nodes.has(key)) {
            out.nodes.set(key, nodes.get(key))
          }
        ${forLoopsEnd.join('\n        ')}
        return out
      },
      eachActive (fn) {
        this.nodes.forEach(fn)
      },
      each (fn) {
        this.nodes.forEach(fn)
      },
    }
  `

  const treeCtor = (
    new Function('nodeCtor', 'treeCtor', code)
  )

  const tree = treeCtor(nodeCtor, treeCtor)

  return tree
}

if (!module.parent && typeof window === 'undefined') {
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

    const leaf = createLeafNode1D([0])
    leaf.set(5, 2.50)
    t.equal(leaf.get(5), 2.5)
    t.equal(leaf.get(0), 0)
    t.equal(leaf.get(1), 0)

    t.end()
  })

  test('defCreateLeafNode (2d float)', (t) => {
    const createLeafNode2D = (new Function('ndarray', 'BitSet', defCreateLeafNode(3, 2)))(ndarray, BitSet)

    const leaf = createLeafNode2D([0, 0])
    leaf.set(5, 2, 2.50)
    t.equal(leaf.get(5, 2), 2.5)
    t.equal(leaf.get(0, 2), 0)
    t.equal(leaf.get(0, 7), 0)

    t.end()
  })

  test('defCreateLeafNode (3d float)', (t) => {
    const createLeafNode2D = (new Function('ndarray', 'BitSet', defCreateLeafNode(3, 2)))(ndarray, BitSet)

    const leaf = createLeafNode2D([0, 0, 0])
    leaf.set(5, 2, 2.50)
    t.equal(leaf.get(5, 2), 2.5)
    t.equal(leaf.get(0, 2), 0)
    t.equal(leaf.get(0, 7), 0)

    t.end()
  })

  test('defCreateInternalNode (1d float)', (t) => {

    const createLeafNode1D = (new Function('ndarray', 'BitSet', defCreateLeafNode(3, 1)))(ndarray, BitSet)
    const createInternalNode1D = (new Function('ndarray', 'BitSet', 'childCtor', defCreateInternalNode(4, 1, createLeafNode1D.baseSum)))(ndarray, BitSet, createLeafNode1D)

    const node = createInternalNode1D([0, 0, 0])
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

  test('createTree', (t) => {
    const tree = createTree([5, 4, 3], 2)

    tree.set(4985732, 12393023, 0.5)
    t.notOk(tree.get(0, 0))
    t.equal(tree.get(4985732, 12393023), 0.5)

    t.end()
  })

  test('Tree#slice', (t) => {
    const tree = createTree([5, 4, 3], 2)

    tree.set(10, 10, 0.5)
    tree.set(5000, 5000, 0.2)

    t.deepEqual(
      Array.from(tree.slice(0, 0, 100, 100).nodes.keys()),
      ['0-0']
    )

    t.deepEqual(
      Array.from(tree.slice(0, 0, 100000, 100000).nodes.keys()),
      ['0-0', '1-1']
    )

    t.deepEqual(
      Array.from(tree.slice(4097, 4097, 100000, 100000).nodes.keys()),
      ['1-1']
    )

    t.deepEqual(
      Array.from(tree.slice(100000, 100000, 0, 0).nodes.keys()),
      [],
      'does not work backwards'
    )

    t.end()
  })

  test('active', (t) => {
    const tree = createTree([5, 4, 3], 1)
    tree.set(-32, 9, true)
    tree.set(-33, 9, false)

    var found = 0
    tree.eachActive((n, i) => {
      t.equal(n.isActive(), true)
      n.eachActive((n2, i2) => {
        found++
        t.equal(true, n2.isActive())
      })
    })

    t.equal(found, 1)

    t.end()
  })
}
