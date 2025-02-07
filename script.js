// 初始化 vis-network 的节点和边的数据集
let nodes = new vis.DataSet([]);
let edges = new vis.DataSet([]);
const container = document.getElementById('network');
const data = { nodes, edges };

// 配置网络参数：启用物理仿真且禁用缩放
const options = {
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
    stabilization: { iterations: 100 }
  },
  interaction: { zoomView: false },
  nodes: {
    shape: 'circle',
    size: 25,
    font: { size: 16, color: '#ffffff' },
    color: {
      background: '#D5C63A',
      border: '#FCBDC5'
    }
  },
  edges: {
    font: { align: 'top' },
    arrows: { to: { enabled: true, scaleFactor: 0.5 } }
  }
};

// 创建网络实例
let network = new vis.Network(container, data, options);

// 根据输入数据更新图形，并根据切换状态更新边的箭头
function updateGraph() {
  const input = document.getElementById('graphData').value;
  const lines = input.split('\n');
  const newNodes = {};    // 用于去重节点
  const newEdges = [];
  const seenEdges = {};   // 用于去重边

  lines.forEach(line => {
    if (line.trim() === '') return;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 2) return; // 至少需要起点和终点
    const from = parts[0];
    const to = parts[1];
    const weight = parts[2] ? parts[2] : '';
    newNodes[from] = true;
    newNodes[to] = true;
    const edgeId = from + "_" + to;
    if (seenEdges[edgeId]) return;
    seenEdges[edgeId] = true;
    const edge = { id: edgeId, from, to };
    if (weight !== '') {
      edge.label = weight;
    }
    newEdges.push(edge);
  });

  // 构造节点数组
  const nodesArray = [];
  for (const id in newNodes) {
    nodesArray.push({ id, label: id });
  }
  nodes.clear();
  nodes.add(nodesArray);
  edges.clear();
  edges.add(newEdges);

  // 根据复选框判断是否显示箭头（有向/无向图）
  const isDirected = document.getElementById('toggleDirected').checked;
  network.setOptions({
    edges: { arrows: isDirected ? { to: { enabled: true, scaleFactor: 0.5 } } : { to: { enabled: false } } }
  });
  network.stabilize();
}

// 绑定输入和复选框事件，实现自动更新
document.getElementById('graphData').addEventListener('input', updateGraph);
document.getElementById('toggleDirected').addEventListener('change', updateGraph);

// 初始渲染
updateGraph();
