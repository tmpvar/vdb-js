module.exports.createTree = createTree

function createTree (levelConfig, dimensions) {
  const LEVEL0_BASE = levelConfig[0]
  const LEVEL1_BASE = levelConfig[1]
  const LEVEL2_BASE = levelConfig[2]

  const LEVEL0_BASE_SUM = LEVEL0_BASE + LEVEL1_BASE + LEVEL2_BASE
  const LEVEL1_BASE_SUM = LEVEL1_BASE + LEVEL2_BASE
  const LEVEL2_BASE_SUM = LEVEL2_BASE

  const LEVEL0_MASK = (1 << LEVEL0_BASE) - 1
  const LEVEL1_MASK = (1 << LEVEL1_BASE) - 1
  const LEVEL2_MASK = (1 << LEVEL2_BASE) - 1

  function getPath (out, pos) {
    out[0] = pos >> LEVEL0_BASE_SUM;
    out[1] = (pos >> LEVEL1_BASE_SUM) & LEVEL0_MASK;
    out[2] = (pos >> LEVEL2_BASE_SUM) & LEVEL1_MASK;
    out[3] = pos & LEVEL2_MASK;
    return out
  }

  const path = [0, 0, 0, 0]

  const level2 = createLeafNode.bind(null, LEVEL2_BASE)

  const level1 = createInternalNode.bind(
    null,
    'level1',
    LEVEL1_BASE,
    LEVEL2_BASE_SUM,
    LEVEL1_MASK,
    level2
  )

  const level0 = createInternalNode.bind(
    null,
    'level0',
    LEVEL0_BASE,
    LEVEL1_BASE_SUM,
    LEVEL0_MASK,
    level1
  )

  return {
    nodes: new Map(),

    set (pos, value) {
      const index = pos >> LEVEL0_BASE_SUM
      if (!this.nodes.has(index)) {
        this.nodes.set(index, level0())
      }

      this.nodes.get(index).set(pos, value)
    },

    get (pos) {
      const index = pos >> LEVEL0_BASE_SUM

      if (!this.nodes.has(index)) {
        return 0
      }

      return this.nodes.get(index).get(pos)
    },

    each (fn) {
      this.nodes.forEach(fn)
    },

    path: getPath,

    createAccessor (x) {
      const accessor = {
        path: [0, 0, 0, 0],
        nodes: [this, null, null, null, null],
        set (v) {

        }
      }

      getPath(accessor.path, x)

      return accessor
    }
  }
}

module.exports.createLeafNode = createLeafNode
function createLeafNode (base) {
  const size = Math.pow(2, base)
  const mask = (1 << base) - 1
  return {
    data: 0x00,
    set (pos, value) {
      const index = pos & mask
      if (value) {
        this.data |= (1 << index)
      } else {
        this.data &= ~(1 << index)
      }
    },

    get (pos) {
      const index = pos & mask
      return !!(this.data & (1 << index))
    },

    size () {
      return size
    }
  }
}

module.exports.createInternalNode = createInternalNode
function createInternalNode(name, base, childBaseSum, parentMask, childCtor) {
  const mask = (1 << base) - 1
  const size = Math.pow(2, childBaseSum + base)
  const localSize = Math.pow(2, base)

  return {
    // preallocate the nodes array
    nodes: new Array(localSize),
    set (pos, value) {
      const index = (pos >> childBaseSum) & parentMask;
      const nodes = this.nodes
      if (!nodes[index]) {
        // expect childCtor to have all of its args bound
        nodes[index] = childCtor()
      }

      nodes[index].set(pos, value)
    },

    get (pos) {
      const index = (pos >> childBaseSum) & parentMask;
      const nodes = this.nodes
      if (!nodes[index]) {
        return 0
      }

      return nodes[index].get(pos)
    },

    each (fn) {
      for (var i=0; i < localSize; i++) {
        if (this.nodes[i]) {
          fn(this.nodes[i], i)
        }
      }
    },

    size () {
      return size
    }
  }
}
