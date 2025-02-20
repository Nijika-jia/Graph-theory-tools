/*!
 * 
 *   _    _      _                            
 *  | |  | |    | |                           
 *  | |  | | ___| | ___ ___  _ __ ___   ___  
 *  | |/\| |/ _ \ |/ __/ _ \| '_ ` _ \ / _ \ 
 *  \  /\  /  __/ | (_| (_) | | | | | |  __/ 
 *   \/  \/ \___|_|\___\___/|_| |_| |_|\___| 
 *                                            
 *   _   _ _ _ _ _          _ _       
 *  | \ | (_|_|_) |        (_|_)      
 *  |  \| |_ _  _| | ____ _ _ _  __ _ 
 *  | . ` | | | | | |/ / _` | | |/ _` |
 *  | |\  | | | | |   < (_| | | | (_| |
 *  |_| \_|_|_|_|_|_|\_\__,_| |_|\__,_|
 *                         _/ |          
 *                        |__/           
 * 
 * https://blog.nijikajia.top/
 * 
 */

class GraphEditor {
    constructor() {
        // 等待所有DOM元素加载完成后再初始化
        this.waitForElements();
    }

    waitForElements() {
        // 所有需要的元素ID列表
        const requiredElements = [
            // 基础元素
            'graphCanvas',
            'graphData',
            'nodeCount',
            
            // 主要操作按钮
            'addNode',
            'addEdge',
            'moveNode',
            'deleteNode',
            'deleteEdge',
            'force',
            
            // 布局相关
            'layout',
            'applyLayout',
            
            // 文件操作
            'clear',
            'save',
            'load',
            
            // 导出相关
            'export',
            'exportFormat',
            
            // 图形属性
            'directedEdge',
            'weight',
            'darkMode',
            
            // 缩放控制
            'zoomIn',
            'zoomOut',
            'resetView',
            
            // 统计面板
            'graphStats'
        ];

        // 检查是否所有元素都存在
        const missingElements = requiredElements.filter(id => !document.getElementById(id));
        
        if (missingElements.length > 0) {
            console.error('缺少以下元素:', missingElements);
            requestAnimationFrame(() => this.waitForElements());
            return;
        }

        // 所有元素都已加载，开始初始化
        this.initializeProperties();
        this.initializeCanvas();
        this.initializeComponents();
        this.setInitialState();
    }

    initializeProperties() {
        this.nodes = [];
        this.edges = [];
        this.selectedNode = null;
        this.mode = 'move';
        this.tempEdge = null;
        this.isDirected = false;
        this.isDragging = false;
        this.draggedNode = null;
        this.isPhysicsEnabled = true;
        this.physicsInterval = null;
        this.fixedNodes = new Set();
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isPanning = false;
        this.lastX = 0;
        this.lastY = 0;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = 50;
        this.theme = {
            background: '#FFFFFF',
            node: {
                fill: '#FFFFFF',
                stroke: '#FF7F5C',
                textColor: '#333333',
                radius: 20,
                fontSize: 14
            },
            edge: {
                color: '#666666',
                width: 2,
                fontSize: 14,
                fontColor: '#666666'
            }
        };
    }

    initializeCanvas() {
        this.canvas = document.getElementById('graphCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    initializeComponents() {
        try {
            this.initializeEvents();
            this.initializeButtons();
            this.initializeInputParser();
            this.initializePhysics();
            this.initializeTheme();
            this.initializeZoomControls();
            this.initializeLayouts();
            this.initializeStylePanel();
            this.initializeExport();
        } catch (error) {
            console.error('初始化组件时出错:', error);
        }
    }

    initializeExport() {
        const exportButton = document.getElementById('export');
        if (exportButton) {
            exportButton.addEventListener('click', () => {
                const format = document.getElementById('exportFormat').value;
                if (!format) return;

                switch(format) {
                    case 'PNG':
                        const dataURL = this.canvas.toDataURL('image/png');
                        const link = document.createElement('a');
                        link.download = 'graph.png';
                        link.href = dataURL;
                        link.click();
                        break;
                    case 'JSON':
                        const data = {
                            nodes: this.nodes,
                            edges: this.edges,
                            isDirected: this.isDirected
                        };
                        this.downloadFile('graph.json', JSON.stringify(data, null, 2));
                        break;
                    case 'DOT':
                        this.exportDOT();
                        break;
                    case 'Matrix':
                        this.exportMatrix();
                        break;
                    case 'List':
                        this.exportAdjacencyList();
                        break;
                    case 'SVG':
                        this.exportSVG();
                        break;
                }
            });
        }
    }

    setInitialState() {
        document.getElementById('moveNode').classList.add('selected');
        document.getElementById('force').classList.add('selected');

        // 使用requestAnimationFrame确保DOM完全准备好
        requestAnimationFrame(() => {
            this.setDefaultData();
            this.saveState();
        });
    }

    setDefaultData() {
        const inputFormat = document.getElementById('inputFormat');
        const graphDataInput = document.getElementById('graphData');
        
        // 默认的边列表数据
        const defaultEdgeList = 
`0 2
0 4 2
0 5
1 4 1
1 5 5
2 3
2 4 3
4 5 1`;

        // 对应的邻接矩阵数据
        const defaultMatrix = 
`0 0 1 0 2 1
0 0 0 0 1 5
1 0 0 1 3 0
0 0 1 0 0 0
2 1 3 0 0 1
1 5 0 0 1 0`;

        if (graphDataInput) {
            // 根据当前选择的格式设置默认数据
            graphDataInput.value = inputFormat.value === 'edgeList' ? 
                defaultEdgeList : defaultMatrix;
            
            // 手动触发数据解析
            this.autoDetectNodeCount(graphDataInput.value);
            this.parseAndCreateGraph();

            // 确保画布大小正确并重绘
            this.resizeCanvas();
            this.draw();

            // 如果开启了物理模拟，确保它在数据加载后启动
            if (this.isPhysicsEnabled) {
                this.startPhysicsSimulation();
            }
        }

        // 添加输入格式切换时的数据更新
        inputFormat.addEventListener('change', () => {
            if (graphDataInput.value === defaultEdgeList || 
                graphDataInput.value === defaultMatrix) {
                graphDataInput.value = inputFormat.value === 'edgeList' ? 
                    defaultEdgeList : defaultMatrix;
                this.parseAndCreateGraph();
            }
        });
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        if (container) {
            // 获取容器的实际大小
            const rect = container.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height;
            
            // 在调整大小后重新绘制
            if (this.nodes.length > 0) {
                this.draw();
            }
        }
    }

    initializeTheme() {
        const themeButton = document.getElementById('darkMode');
        themeButton.addEventListener('click', () => {
            const isDarkMode = document.body.classList.toggle('dark-mode');
            themeButton.textContent = isDarkMode ? '🌙' : '🌞';
            this.setTheme(isDarkMode);
        });
    }

    setTheme(isDark) {
        this.theme = isDark ? {
            background: '#1E1E1E',
            node: {
                fill: '#2D2D2D',
                stroke: '#4F8BFF',
                textColor: '#FFFFFF',
                radius: 20,
                fontSize: 14
            },
            edge: {
                color: '#CCCCCC',
                width: 2,
                fontSize: 14,
                fontColor: '#CCCCCC'
            }
        } : {
            background: '#FFFFFF',
            node: {
                fill: '#FFFFFF',
                stroke: '#FF7F5C',
                textColor: '#333333',
                radius: 20,
                fontSize: 14
            },
            edge: {
                color: '#666666',
                width: 2,
                fontSize: 14,
                fontColor: '#666666'
            }
        };
        this.draw();
    }

    initializeEvents() {
        // 检测是否支持触摸事件
        const isTouchDevice = 'ontouchstart' in window;

        if (isTouchDevice) {
            let lastTapTime = 0;
            let touchStartX = 0;
            let touchStartY = 0;

            this.canvas.addEventListener('touchstart', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                touchStartX = touch.clientX - rect.left;
                touchStartY = touch.clientY - rect.top;

                // 检测双击/双触
                const currentTime = new Date().getTime();
                const tapLength = currentTime - lastTapTime;
                if (tapLength < 300 && tapLength > 0) {
                    // 双击操作 - 添加节点
                    if (this.mode === 'node') {
                        this.handleCanvasClick({
                            clientX: touchStartX + rect.left,
                            clientY: touchStartY + rect.top
                        });
                    }
                }
                lastTapTime = currentTime;

                // 处理拖拽开始
                this.handleMouseDown({
                    clientX: touchStartX + rect.left,
                    clientY: touchStartY + rect.top
                });
            });

            this.canvas.addEventListener('touchmove', (e) => {
                e.preventDefault();
                const touch = e.touches[0];
                const rect = this.canvas.getBoundingClientRect();
                const x = touch.clientX - rect.left;
                const y = touch.clientY - rect.top;

                // 处理拖拽移动
                this.handleMouseMove({
                    clientX: x + rect.left,
                    clientY: y + rect.top
                });

                // 如果是两指触摸，处理缩放
                if (e.touches.length === 2) {
                    const touch2 = e.touches[1];
                    const dist = Math.hypot(
                        touch2.clientX - touch.clientX,
                        touch2.clientY - touch.clientY
                    );
                    
                    if (this.lastPinchDistance) {
                        const scale = dist / this.lastPinchDistance;
                        const centerX = (touch.clientX + touch2.clientX) / 2 - rect.left;
                        const centerY = (touch.clientY + touch2.clientY) / 2 - rect.top;
                        this.zoom(scale, centerX, centerY);
                    }
                    this.lastPinchDistance = dist;
                }
            });

            this.canvas.addEventListener('touchend', (e) => {
                // 处理点击事件
                if (!this.isDragging) {
                    const rect = this.canvas.getBoundingClientRect();
                    this.handleCanvasClick({
                        clientX: touchStartX + rect.left,
                        clientY: touchStartY + rect.top
                    });
                }

                this.handleMouseUp();
                this.lastPinchDistance = null;

                // 如果是最后一个手指离开，重置所有状态
                if (e.touches.length === 0) {
                    this.isPanning = false;
                }
            });
        }

        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', () => this.handleMouseUp());

        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            this.zoom(e.deltaY > 0 ? 0.9 : 1.1, x, y);
        });

        this.canvas.addEventListener('mousedown', (e) => {
            if (e.button === 1) { // 中键
                e.preventDefault();
                this.isPanning = true;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (this.isPanning) {
                this.offsetX += e.clientX - this.lastX;
                this.offsetY += e.clientY - this.lastY;
                this.lastX = e.clientX;
                this.lastY = e.clientY;
                this.draw();
            }
        });

        document.addEventListener('mouseup', (e) => {
            if (e.button === 1) {
                this.isPanning = false;
            }
        });

        // 添加键盘快捷键支持
        document.addEventListener('keydown', (e) => {
            // 如果正在输入，不处理快捷键
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch(e.key) {
                case 'n':
                case 'N':
                    this.setMode('node');
                    break;
                case 'e':
                case 'E':
                    this.setMode('edge');
                    break;
                case 'm':
                case 'M':
                    this.setMode('move');
                    break;
                case 'f':
                case 'F':
                    this.togglePhysics();
                    break;
                case 'Delete':
                    if (this.selectedNode) {
                        this.nodes = this.nodes.filter(n => n !== this.selectedNode);
                        this.edges = this.edges.filter(e => 
                            e.from !== this.selectedNode && e.to !== this.selectedNode
                        );
                        this.selectedNode = null;
                        this.saveState();
                        this.draw();
                        this.updateInputFields();
                    }
                    break;
                case 'Escape':
                    this.selectedNode = null;
                    this.draw();
                    break;
                case 'z':
                    if (e.ctrlKey || e.metaKey) {
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                        e.preventDefault();
                    }
                    break;
                case 'y':
                    if (e.ctrlKey || e.metaKey) {
                        this.redo();
                        e.preventDefault();
                    }
                    break;
            }
        });
    }

    initializeButtons() {
        const buttonHandlers = {
            'addNode': () => this.setMode('node'),
            'addEdge': () => this.setMode('edge'),
            'moveNode': () => this.setMode('move'),
            'deleteNode': () => this.setMode('deleteNode'),
            'deleteEdge': () => this.setMode('deleteEdge'),
            'clear': () => {
                this.nodes = [];
                this.edges = [];
                this.draw();
                this.updateInputFields();
            },
            'save': () => {
                const data = {
                    nodes: this.nodes,
                    edges: this.edges,
                    isDirected: this.isDirected
                };
                const json = JSON.stringify(data, null, 2);
                const blob = new Blob([json], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = 'graph_data.json';
                link.href = url;
                link.click();
                URL.revokeObjectURL(url);
            },
            'load': () => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.json';
                input.onchange = (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                            try {
                                const data = JSON.parse(event.target.result);
                                this.nodes = data.nodes;
                                this.edges = data.edges;
                                
                                // 恢复有向图状态
                                if (data.isDirected !== undefined) {
                                    this.isDirected = data.isDirected;
                                    document.getElementById('directedEdge').checked = data.isDirected;
                                }
                                
                                this.draw();
                                this.updateInputFields();
                                this.saveState(); // 将加载的状态添加到历史记录
                            } catch (error) {
                                alert('无法加载文件：文件格式不正确');
                                console.error('加载文件时出错:', error);
                            }
                        };
                        reader.readAsText(file);
                    }
                };
                input.click();
            },
            'directedEdge': (e) => {
                this.isDirected = e.target.checked;
                // 更新所有现有边的directed属性
                this.edges.forEach(edge => {
                    edge.directed = this.isDirected;
                });
                this.draw();
                this.updateGraphStats(); // 重新计算统计信息
            },
            'toggleStyle': () => {
                const stylePanel = document.querySelector('.style-panel');
                if (stylePanel) {
                    stylePanel.style.display = stylePanel.style.display === 'none' ? 'block' : 'none';
                }
            }
        };

        // 安全地添加事件监听器
        Object.entries(buttonHandlers).forEach(([id, handler]) => {
            const element = document.getElementById(id);
            if (element) {
                if (id === 'directedEdge') {
                    element.addEventListener('change', handler);
                } else {
                    element.addEventListener('click', handler);
                }
            }
        });
    }

    initializeInputParser() {
        const graphData = document.getElementById('graphData');
        const inputFormat = document.getElementById('inputFormat');
        
        // 更新placeholder提示和转换数据格式
        inputFormat.addEventListener('change', () => {
            // 更新placeholder
            if (inputFormat.value === 'edgeList') {
                graphData.placeholder = 
                    "每行输入两个或三个数字表示边的连接关系\n" +
                    "格式：起点 终点 [权重]\n" +
                    "例如:\n" +
                    "1 0\n" +
                    "2 1 5\n" +
                    "3 2";
            } else {
                graphData.placeholder = 
                    "输入N×N的邻接矩阵\n" +
                    "0表示无边，非0表示边权重\n" +
                    "例如:\n" +
                    "0 1 0\n" +
                    "1 0 1\n" +
                    "0 1 0";
            }

            // 转换当前数据到新格式
            if (this.nodes.length > 0) {
                this.updateInputText();
            }
        });

        graphData.addEventListener('input', () => {
            this.autoDetectNodeCount(graphData.value);
            this.parseAndCreateGraph();
        });
    }

    initializePhysics() {
        const forceButton = document.getElementById('force');
        if (forceButton) {
            forceButton.addEventListener('click', () => {
                this.togglePhysics();
                // 更新按钮状态
                forceButton.classList.toggle('selected', this.isPhysicsEnabled);
            });
        }
    }

    togglePhysics() {
        this.isPhysicsEnabled = !this.isPhysicsEnabled;
        
        if (this.isPhysicsEnabled) {
            this.startPhysicsSimulation();
        } else {
            this.stopPhysicsSimulation();
        }
    }

    startPhysicsSimulation() {
        if (this.physicsInterval) {
            clearInterval(this.physicsInterval);
        }
        
        this.physicsInterval = setInterval(() => {
            this.updatePhysics();
            this.draw();
        }, 1000 / 60); // 60 FPS
    }

    stopPhysicsSimulation() {
        if (this.physicsInterval) {
            clearInterval(this.physicsInterval);
            this.physicsInterval = null;
        }
    }

    updatePhysics() {
        const k = 0.05; // 减小弹力系数
        const repulsion = 2000; // 减小斥力系数
        const centerAttraction = 0.003; // 减小中心引力系数
        const damping = 0.7; // 增加阻尼
        const idealLength = 150; // 理想边长

        // 为每个节点初始化速度
        this.nodes.forEach(node => {
            if (!node.vx) node.vx = 0;
            if (!node.vy) node.vy = 0;
        });

        // 修改节点碰撞检测的距离
        const minDistance = this.theme.node.radius * 2;
        
        // 计算所有力
        this.nodes.forEach(node1 => {
            if (this.fixedNodes.has(node1)) return; // 跳过固定节点

            let fx = 0;
            let fy = 0;

            // 节点间斥力
            this.nodes.forEach(node2 => {
                if (node1 === node2) return;

                const dx = node1.x - node2.x;
                const dy = node1.y - node2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < minDistance) {
                    // 增加斥力以防止节点重叠
                    const force = repulsion * 2;
                    fx += (dx / distance) * force;
                    fy += (dy / distance) * force;
                }
            });

            // 边的弹力
            this.edges.forEach(edge => {
                if (edge.from === node1 || edge.to === node1) {
                    const otherNode = edge.from === node1 ? edge.to : edge.from;
                    const dx = node1.x - otherNode.x;
                    const dy = node1.y - otherNode.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 1) return;

                    const force = k * (distance - idealLength);
                    fx -= (dx / distance) * force;
                    fy -= (dy / distance) * force;
                }
            });

            // 中心引力
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            const dx = node1.x - centerX;
            const dy = node1.y - centerY;
            const centerDist = Math.sqrt(dx * dx + dy * dy);
            if (centerDist > 200) { // 只有当节点离中心太远时才施加中心引力
                fx -= dx * centerAttraction;
                fy -= dy * centerAttraction;
            }

            // 更新速度和位置
            node1.vx = (node1.vx + fx) * damping;
            node1.vy = (node1.vy + fy) * damping;

            // 速度限制
            const maxSpeed = 5;
            const speed = Math.sqrt(node1.vx * node1.vx + node1.vy * node1.vy);
            if (speed > maxSpeed) {
                node1.vx = (node1.vx / speed) * maxSpeed;
                node1.vy = (node1.vy / speed) * maxSpeed;
            }

            node1.x += node1.vx;
            node1.y += node1.vy;

            // 限制节点在画布范围内
            const padding = 50;
            node1.x = Math.max(padding, Math.min(this.canvas.width - padding, node1.x));
            node1.y = Math.max(padding, Math.min(this.canvas.height - padding, node1.y));
        });
    }

    autoDetectNodeCount(edgeData) {
        if (!edgeData.trim()) {
            document.getElementById('nodeCount').value = '';
            return;
        }

        // 从边数据中提取所有节点编号
        const nodes = new Set();
        edgeData.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .forEach(line => {
                const [from, to, weight] = line.split(' ').map(n => parseInt(n));
                if (!isNaN(from)) nodes.add(from);
                if (!isNaN(to)) nodes.add(to);
            });

        if (nodes.size > 0) {
            const minNode = Math.min(...nodes);
            const maxNode = Math.max(...nodes);
            document.getElementById('nodeCount').value = `${minNode} ${maxNode}`;
        }
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.offsetX) / this.scale,
            y: (e.clientY - rect.top - this.offsetY) / this.scale
        };
    }

    updateInputFields() {
        // 更新节点数量输入框
        if (this.nodes.length > 0) {
            const minId = Math.min(...this.nodes.map(n => n.id));
            const maxId = Math.max(...this.nodes.map(n => n.id));
            document.getElementById('nodeCount').value = `${minId} ${maxId}`;
        } else {
            document.getElementById('nodeCount').value = '';
        }

        // 更新图数据输入框
        const edgeData = this.edges.map(edge => 
            edge.weight !== undefined ? 
            `${edge.from.id} ${edge.to.id} ${edge.weight}` : 
            `${edge.from.id} ${edge.to.id}`
        ).join('\n');
        document.getElementById('graphData').value = edgeData;
    }

    handleCanvasClick(e) {
        const pos = this.getMousePos(e);
        const clickedNode = this.findNode(pos);
        
        if (this.mode === 'selectStart' && clickedNode) {
            const algorithm = document.getElementById('algorithm').value;
            this.mode = 'move';
            this.runAlgorithm(algorithm, clickedNode);
            return;
        }
        
        switch(this.mode) {
            case 'node':
                // 找到当前最大ID
                const maxId = this.nodes.length > 0 
                    ? Math.max(...this.nodes.map(n => n.id)) 
                    : -1;
                
                this.nodes.push({
                    x: pos.x,
                    y: pos.y,
                    id: maxId + 1
                });
                this.saveState();
                break;
                
            case 'edge':
                if (clickedNode) {
                    if (!this.selectedNode) {
                        this.selectedNode = clickedNode;
                    } else if (this.selectedNode !== clickedNode) {
                        const weightInput = document.getElementById('weight');
                        const weight = weightInput.value ? parseInt(weightInput.value) : undefined;
                        
                        this.edges.push({
                            from: this.selectedNode,
                            to: clickedNode,
                            weight: weight,
                            directed: this.isDirected  // 确保新边使用当前的directed设置
                        });
                        this.selectedNode = null;
                        weightInput.value = '';
                        this.saveState();
                        this.updateGraphStats(); // 更新统计信息
                    }
                }
                break;
                
            case 'deleteNode':
                if (clickedNode) {
                    this.nodes = this.nodes.filter(n => n !== clickedNode);
                    this.edges = this.edges.filter(e => 
                        e.from !== clickedNode && e.to !== clickedNode
                    );
                    this.saveState();
                }
                break;
                
            case 'deleteEdge':
                const clickedEdge = this.findEdge(pos);
                if (clickedEdge) {
                    this.edges = this.edges.filter(e => e !== clickedEdge);
                    this.saveState();
                }
                break;
        }
        
        this.updateInputText();
        this.draw();
    }

    handleMouseDown(e) {
        if (this.mode === 'move' || this.isPhysicsEnabled) {
            const pos = this.getMousePos(e);
            this.draggedNode = this.findNode(pos);
            if (this.draggedNode) {
                this.isDragging = true;
                if (this.isPhysicsEnabled) {
                    this.draggedNode.vx = 0;
                    this.draggedNode.vy = 0;
                }
            }
        }
    }

    handleMouseUp() {
        if (this.draggedNode) {
            if (this.isPhysicsEnabled) {
                this.draggedNode.vx = 0;
                this.draggedNode.vy = 0;
            }
            this.draggedNode = null;
            this.isDragging = false;
            this.updateInputText();
        }
        if (this.tempEdge) {
            this.tempEdge = null;
            this.draw();
        }
    }

    handleMouseMove(e) {
        if (this.selectedNode) {
            const pos = this.getMousePos(e);
            this.tempEdge = {
                from: this.selectedNode,
                to: pos
            };
            this.draw();
        }
        
        if (this.isDragging && this.draggedNode) {
            const pos = this.getMousePos(e);
            this.draggedNode.x = pos.x;
            this.draggedNode.y = pos.y;
            if (this.isPhysicsEnabled) {
                this.draggedNode.vx = 0;
                this.draggedNode.vy = 0;
            }
            this.draw();
        }
    }

    findNode(pos) {
        const radius = 20;
        return this.nodes.find(node => {
            const dx = node.x - pos.x;
            const dy = node.y - pos.y;
            return dx * dx + dy * dy < radius * radius;
        });
    }

    findEdge(pos) {
        return this.edges.find(edge => {
            const dist = this.pointToLineDistance(
                pos,
                {x: edge.from.x, y: edge.from.y},
                {x: edge.to.x, y: edge.to.y}
            );
            return dist < 5;
        });
    }

    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) param = dot / lenSq;
        
        let xx, yy;
        
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }
        
        const dx = point.x - xx;
        const dy = point.y - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }

    draw() {
        // 清除画布并设置背景色
        this.ctx.fillStyle = this.theme.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 保存当前状态
        this.ctx.save();

        // 应用缩放和平移
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // 绘制边
        this.edges.forEach(edge => {
            this.drawEdge(edge.from, edge.to, edge);
        });
        
        // 绘制临时边
        if (this.tempEdge) {
            this.drawEdge(this.tempEdge.from, this.tempEdge.to, null);
        }

        // 绘制节点
        this.nodes.forEach(node => {
            this.drawNode(node);
        });

        // 绘制选中节点的高亮效果
        if (this.selectedNode) {
            this.ctx.beginPath();
            this.ctx.arc(
                this.selectedNode.x,
                this.selectedNode.y,
                this.theme.node.radius + 4,
                0,
                2 * Math.PI
            );
            this.ctx.strokeStyle = this.theme.node.stroke;
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        }

        // 恢复状态
        this.ctx.restore();

        // 更新统计信息
        this.updateGraphStats();
    }

    drawNode(node) {
        // 绘制节点圆形
        this.ctx.beginPath();
        this.ctx.arc(node.x, node.y, this.theme.node.radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = this.theme.node.fill;
        this.ctx.fill();
        this.ctx.strokeStyle = this.theme.node.stroke;
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // 绘制节点ID
        this.ctx.font = `${this.theme.node.fontSize}px Arial`;
        this.ctx.fillStyle = this.theme.node.textColor;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText(node.id.toString(), node.x, node.y);
    }

    drawEdge(from, to, edge) {
        const startX = from.x;
        const startY = from.y;
        const endX = to.x;
        const endY = to.y;

        // 计算边的实际起点和终点（考虑节点半径）
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const radius = this.theme.node.radius;

        // 调整起点和终点，使边不会穿过节点
        const startFraction = radius / distance;
        const endFraction = (distance - radius) / distance;
        
        const actualStartX = startX + dx * startFraction;
        const actualStartY = startY + dy * startFraction;
        const actualEndX = startX + dx * endFraction;
        const actualEndY = startY + dy * endFraction;

        // 绘制边
        this.ctx.beginPath();
        this.ctx.moveTo(actualStartX, actualStartY);
        this.ctx.lineTo(actualEndX, actualEndY);
        this.ctx.strokeStyle = this.theme.edge.color;
        this.ctx.lineWidth = this.theme.edge.width;
        this.ctx.stroke();

        // 如果是有向边，绘制箭头
        if (edge && edge.directed) {
            const headLength = 15; // 箭头长度
            const headAngle = Math.PI / 6; // 箭头角度

            const angle = Math.atan2(dy, dx);

            // 绘制箭头
            this.ctx.beginPath();
            this.ctx.moveTo(actualEndX, actualEndY);
            this.ctx.lineTo(
                actualEndX - headLength * Math.cos(angle - headAngle),
                actualEndY - headLength * Math.sin(angle - headAngle)
            );
            this.ctx.lineTo(
                actualEndX - headLength * Math.cos(angle + headAngle),
                actualEndY - headLength * Math.sin(angle + headAngle)
            );
            this.ctx.closePath();
            this.ctx.fillStyle = this.theme.edge.color;
            this.ctx.fill();
        }

        // 如果有权重且不为0，绘制权重标签
        if (edge && edge.weight !== undefined && edge.weight !== 0) {
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            this.ctx.font = `${this.theme.edge.fontSize}px Arial`;
            this.ctx.fillStyle = this.theme.edge.fontColor;
            this.ctx.fillText(edge.weight.toString(), midX, midY);
        }
    }

    setMode(newMode) {
        this.mode = newMode;
        this.selectedNode = null;
        this.tempEdge = null;
        
        // 更新按钮样式
        const buttons = ['addNode', 'addEdge', 'moveNode', 'deleteNode', 'deleteEdge'];
        buttons.forEach(id => {
            const button = document.getElementById(id);
            if (button) {
                button.classList.remove('selected');
            }
        });
        
        const modeButton = document.getElementById(newMode === 'node' ? 'addNode' : newMode);
        if (modeButton) {
            modeButton.classList.add('selected');
        }
    }

    parseAndCreateGraph() {
        const data = document.getElementById('graphData').value.trim();
        const format = document.getElementById('inputFormat').value;
        
        if (!data) return;

        // 清除现有的图
        this.nodes = [];
        this.edges = [];

        if (format === 'edgeList') {
            this.parseEdgeList(data);
        } else {
            this.parseAdjacencyMatrix(data);
        }

        this.draw();
        this.updateGraphStats();
    }

    parseEdgeList(data) {
        const lines = data.split('\n');
        const nodeSet = new Set();

        // 第一遍：收集所有节点
        lines.forEach(line => {
            const [from, to] = line.trim().split(/\s+/).map(Number);
            if (!isNaN(from) && !isNaN(to)) {
                nodeSet.add(from);
                nodeSet.add(to);
            }
        });

        // 创建节点
        Array.from(nodeSet).sort((a, b) => a - b).forEach(id => {
            this.nodes.push({
                id,
                x: Math.random() * this.canvas.width * 0.8 + this.canvas.width * 0.1,
                y: Math.random() * this.canvas.height * 0.8 + this.canvas.height * 0.1
            });
        });

        // 创建边
        lines.forEach(line => {
            const parts = line.trim().split(/\s+/).map(Number);
            if (parts.length >= 2) {
                const [from, to, weight] = parts;
                const fromNode = this.nodes.find(n => n.id === from);
                const toNode = this.nodes.find(n => n.id === to);
                if (fromNode && toNode) {
                    this.edges.push({
                        from: fromNode,
                        to: toNode,
                        weight: weight || undefined,
                        directed: this.isDirected
                    });
                }
            }
        });
    }

    parseAdjacencyMatrix(data) {
        const lines = data.trim().split('\n');
        const matrix = lines.map(line => 
            line.trim().split(/\s+/).map(val => val === '+' ? 1 : Number(val))
        );

        // 验证矩阵是否合法
        const n = matrix.length;
        if (!matrix.every(row => row.length === n)) {
            console.error('邻接矩阵格式不正确');
            return;
        }

        // 创建节点
        for (let i = 0; i < n; i++) {
            this.nodes.push({
                id: i,
                x: Math.random() * this.canvas.width * 0.8 + this.canvas.width * 0.1,
                y: Math.random() * this.canvas.height * 0.8 + this.canvas.height * 0.1
            });
        }

        // 创建边
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (matrix[i][j] !== 0) {
                    this.edges.push({
                        from: this.nodes[i],
                        to: this.nodes[j],
                        weight: matrix[i][j] === 1 ? undefined : matrix[i][j],
                        directed: this.isDirected
                    });
                }
            }
        }
    }

    initializeZoomControls() {
        document.getElementById('zoomIn').addEventListener('click', () => {
            this.zoom(1.2);
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            this.zoom(0.8);
        });

        document.getElementById('resetView').addEventListener('click', () => {
            this.resetView();
        });
    }

    zoom(factor, centerX = this.canvas.width / 2, centerY = this.canvas.height / 2) {
        const oldScale = this.scale;
        this.scale *= factor;
        this.scale = Math.max(0.1, Math.min(5, this.scale));
        
        // 调整偏移以保持缩放中心不变
        this.offsetX = centerX - (centerX - this.offsetX) * (this.scale / oldScale);
        this.offsetY = centerY - (centerY - this.offsetY) * (this.scale / oldScale);
        
        this.draw();
    }

    resetView() {
        this.scale = 1;
        this.offsetX = 0;
        this.offsetY = 0;
        this.draw();
    }

    saveState() {
        const state = {
            nodes: JSON.parse(JSON.stringify(this.nodes)),
            edges: JSON.parse(JSON.stringify(this.edges))
        };
        
        this.history = this.history.slice(0, this.historyIndex + 1);
        this.history.push(state);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
        this.historyIndex = this.history.length - 1;
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            const state = this.history[this.historyIndex];
            this.nodes = JSON.parse(JSON.stringify(state.nodes));
            this.edges = JSON.parse(JSON.stringify(state.edges));
            this.draw();
            this.updateInputFields();
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            const state = this.history[this.historyIndex];
            this.nodes = JSON.parse(JSON.stringify(state.nodes));
            this.edges = JSON.parse(JSON.stringify(state.edges));
            this.draw();
            this.updateInputFields();
        }
    }

    initializeLayouts() {
        document.getElementById('applyLayout').addEventListener('click', () => {
            const layout = document.getElementById('layout').value;
            if (!layout) return;

            this.stopPhysicsSimulation();
            
            switch(layout) {
                case 'Circle':
                    this.applyCircleLayout();
                    break;
                case 'Grid':
                    this.applyGridLayout();
                    break;
                case 'Tree':
                    this.applyTreeLayout();
                    break;
            }

            this.draw();
            if (this.isPhysicsEnabled) {
                this.startPhysicsSimulation();
            }
        });
    }

    applyCircleLayout() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.min(this.canvas.width, this.canvas.height) / 3;

        this.nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / this.nodes.length;
            node.x = centerX + radius * Math.cos(angle);
            node.y = centerY + radius * Math.sin(angle);
            node.vx = 0;
            node.vy = 0;
        });
    }

    applyGridLayout() {
        const padding = 100;
        const cols = Math.ceil(Math.sqrt(this.nodes.length));
        const cellWidth = (this.canvas.width - 2 * padding) / cols;
        const cellHeight = (this.canvas.height - 2 * padding) / cols;

        this.nodes.forEach((node, i) => {
            const row = Math.floor(i / cols);
            const col = i % cols;
            node.x = padding + col * cellWidth + cellWidth / 2;
            node.y = padding + row * cellHeight + cellHeight / 2;
            node.vx = 0;
            node.vy = 0;
        });
    }

    applyTreeLayout() {
        if (this.nodes.length === 0) return;

        // 找到根节点（入度为0或最小的节点）
        const inDegrees = new Map();
        this.nodes.forEach(node => inDegrees.set(node, 0));
        this.edges.forEach(edge => {
            const to = edge.to;
            inDegrees.set(to, inDegrees.get(to) + 1);
        });

        const root = [...inDegrees.entries()]
            .reduce((min, curr) => curr[1] < min[1] ? curr : min)[0];

        // 使用BFS计算每个节点的层级
        const levels = new Map();
        const visited = new Set();
        const queue = [[root, 0]];
        visited.add(root);

        while (queue.length > 0) {
            const [node, level] = queue.shift();
            levels.set(node, level);

            const neighbors = this.edges
                .filter(e => e.from === node)
                .map(e => e.to);

            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    visited.add(neighbor);
                    queue.push([neighbor, level + 1]);
                }
            }
        }

        // 计算每层节点数
        const levelCounts = new Map();
        levels.forEach((level, node) => {
            levelCounts.set(level, (levelCounts.get(level) || 0) + 1);
        });

        // 布局节点
        const levelHeight = this.canvas.height / (Math.max(...levels.values()) + 2);
        levels.forEach((level, node) => {
            const levelWidth = this.canvas.width / (levelCounts.get(level) + 1);
            const nodesAtLevel = [...levels.entries()]
                .filter(([_, l]) => l === level)
                .map(([n, _]) => n);
            const index = nodesAtLevel.indexOf(node);
            
            node.x = levelWidth * (index + 1);
            node.y = levelHeight * (level + 1);
            node.vx = 0;
            node.vy = 0;
        });
    }

    // 添加图形统计功能
    updateGraphStats() {
        const stats = {
            nodes: this.nodes.length,
            edges: this.edges.length,
            components: this.countComponents(),
            isConnected: this.isConnected(),
            hasCycle: this.hasCycle(),
            isTree: this.isTree(),
            isBipartite: this.isBipartite(),
            diameter: this.calculateDiameter(),
        };

        const statsHtml = `
            <div>基本信息：</div>
            <div>・节点数：${stats.nodes}</div>
            <div>・边数：${stats.edges}</div>
            
            <div style="margin-top: 10px">图的性质：</div>
            <div>・连通分量数：${stats.components}</div>
            <div>・是否连通：${stats.isConnected ? '是' : '否'}</div>
            <div>・是否有环：${stats.hasCycle ? '是' : '否'}</div>
            <div>・是否为树：${stats.isTree ? '是' : '否'}</div>
            <div>・是否为二分图：${stats.isBipartite ? '是' : '否'}</div>
            <div>・最长最短路径长度：${stats.isConnected ? stats.diameter : '∞'}</div>
        `;

        document.getElementById('graphStats').innerHTML = statsHtml;
    }

    calculateDensity() {
        const n = this.nodes.length;
        const m = this.edges.length;
        const maxEdges = this.isDirected ? n * (n - 1) : (n * (n - 1)) / 2;
        return n <= 1 ? 0 : m / maxEdges;
    }

    calculateAverageDegree() {
        if (this.nodes.length === 0) return 0;
        const degrees = this.nodes.map(node => 
            this.edges.filter(e => e.from === node || e.to === node).length
        );
        return degrees.reduce((a, b) => a + b, 0) / this.nodes.length;
    }

    calculateMaxDegree() {
        if (this.nodes.length === 0) return 0;
        return Math.max(...this.nodes.map(node => 
            this.edges.filter(e => e.from === node || e.to === node).length
        ));
    }

    calculateMinDegree() {
        if (this.nodes.length === 0) return 0;
        return Math.min(...this.nodes.map(node => 
            this.edges.filter(e => e.from === node || e.to === node).length
        ));
    }

    getIsolatedNodes() {
        return this.nodes.filter(node => 
            !this.edges.some(e => e.from === node || e.to === node)
        ).length;
    }

    countComponents() {
        const visited = new Set();
        let count = 0;

        const dfs = (node) => {
            visited.add(node);
            const neighbors = this.edges
                .filter(e => e.from === node || e.to === node)
                .map(e => e.from === node ? e.to : e.from);
            
            for (const neighbor of neighbors) {
                if (!visited.has(neighbor)) {
                    dfs(neighbor);
                }
            }
        };

        for (const node of this.nodes) {
            if (!visited.has(node)) {
                count++;
                dfs(node);
            }
        }

        return count;
    }

    isConnected() {
        return this.countComponents() === 1;
    }

    hasCycle() {
        if (this.nodes.length === 0) return false;

        // 对于有向图和无向图使用不同的检测方法
        return this.isDirected ? this.hasDirectedCycle() : this.hasUndirectedCycle();
    }

    // 添加有向图环检测方法
    hasDirectedCycle() {
        const visited = new Set();
        const recursionStack = new Set();

        // 对每个未访问的节点进行DFS
        for (const node of this.nodes) {
            if (this.hasCycleUtil(node, visited, recursionStack)) {
                return true;
            }
        }
        return false;
    }

    // DFS辅助方法
    hasCycleUtil(node, visited, recursionStack) {
        if (recursionStack.has(node)) {
            return true; // 找到环
        }

        if (visited.has(node)) {
            return false; // 已经检查过这个路径
        }

        visited.add(node);
        recursionStack.add(node);

        // 获取当前节点的所有出边
        const outEdges = this.edges.filter(edge => edge.from === node);
        
        for (const edge of outEdges) {
            if (this.hasCycleUtil(edge.to, visited, recursionStack)) {
                return true;
            }
        }

        recursionStack.delete(node); // 回溯时移除节点
        return false;
    }

    // 无向图环检测方法
    hasUndirectedCycle() {
        const visited = new Set();
        const parent = new Map();

        // 对每个未访问的节点进行DFS
        for (const node of this.nodes) {
            if (!visited.has(node)) {
                if (this.hasUndirectedCycleUtil(node, visited, parent)) {
                    return true;
                }
            }
        }
        return false;
    }

    hasUndirectedCycleUtil(node, visited, parent) {
        visited.add(node);

        // 获取相邻节点
        const neighbors = this.edges
            .filter(edge => edge.from === node || edge.to === node)
            .map(edge => edge.from === node ? edge.to : edge.from);

        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                parent.set(neighbor, node);
                if (this.hasUndirectedCycleUtil(neighbor, visited, parent)) {
                    return true;
                }
            } else if (neighbor !== parent.get(node)) {
                return true;
            }
        }
        return false;
    }

    calculateDiameter() {
        if (!this.isConnected() || this.nodes.length === 0) return Infinity;
        
        // Floyd-Warshall算法
        const n = this.nodes.length;
        const dist = Array(n).fill().map(() => Array(n).fill(Infinity));
        
        // 初始化距离矩阵
        for (let i = 0; i < n; i++) dist[i][i] = 0;
        this.edges.forEach(edge => {
            const u = this.nodes.indexOf(edge.from);
            const v = this.nodes.indexOf(edge.to);
            dist[u][v] = 1;
            if (!this.isDirected) dist[v][u] = 1;
        });
        
        // Floyd-Warshall
        for (let k = 0; k < n; k++) {
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (dist[i][k] !== Infinity && dist[k][j] !== Infinity) {
                        dist[i][j] = Math.min(dist[i][j], dist[i][k] + dist[k][j]);
                    }
                }
            }
        }
        
        // 计算直径
        let diameter = 0;
        for (let i = 0; i < n; i++) {
            for (let j = 0; j < n; j++) {
                if (dist[i][j] !== Infinity) {
                    diameter = Math.max(diameter, dist[i][j]);
                }
            }
        }
        return diameter;
    }

    isTree() {
        return this.isConnected() && !this.hasCycle() && 
               this.edges.length === this.nodes.length - 1;
    }

    isBipartite() {
        if (this.nodes.length === 0) return true;
        
        const colors = new Map();
        
        const dfs = (node, color) => {
            colors.set(node, color);
            
            const neighbors = this.edges
                .filter(e => e.from === node || e.to === node)
                .map(e => e.from === node ? e.to : e.from);
                
            for (const neighbor of neighbors) {
                if (!colors.has(neighbor)) {
                    if (!dfs(neighbor, 1 - color)) return false;
                } else if (colors.get(neighbor) === color) {
                    return false;
                }
            }
            return true;
        };
        
        for (const node of this.nodes) {
            if (!colors.has(node)) {
                if (!dfs(node, 0)) return false;
            }
        }
        return true;
    }

    findMaxClique() {
        // Implementation of findMaxClique method
        // This is a placeholder and should be implemented based on your specific requirements
        return new Set();
    }

    calculateChromaticNumber() {
        // Implementation of calculateChromaticNumber method
        // This is a placeholder and should be implemented based on your specific requirements
        return 0;
    }

    calculateRadius() {
        if (!this.isConnected() || this.nodes.length === 0) return Infinity;
        
        const eccentricities = this.calculateEccentricities();
        return Math.min(...eccentricities.values());
    }

    findCenter() {
        if (!this.isConnected() || this.nodes.length === 0) return [];
        
        const eccentricities = this.calculateEccentricities();
        const radius = Math.min(...eccentricities.values());
        
        return this.nodes
            .filter(node => eccentricities.get(node) === radius)
            .map(node => node.id);
    }

    calculateEccentricities() {
        const eccentricities = new Map();
        const n = this.nodes.length;
        const dist = this.floydWarshall();
        
        for (let i = 0; i < n; i++) {
            let maxDist = 0;
            for (let j = 0; j < n; j++) {
                if (dist[i][j] !== Infinity) {
                    maxDist = Math.max(maxDist, dist[i][j]);
                }
            }
            eccentricities.set(this.nodes[i], maxDist);
        }
        
        return eccentricities;
    }

    calculateGirth() {
        if (!this.hasCycle()) return Infinity;
        
        let minCycle = Infinity;
        const n = this.nodes.length;
        const dist = this.floydWarshall();
        
        for (const edge of this.edges) {
            const u = this.nodes.indexOf(edge.from);
            const v = this.nodes.indexOf(edge.to);
            
            // 不考虑这条边的最短路径长度
            const pathLength = dist[u][v];
            if (pathLength !== Infinity) {
                minCycle = Math.min(minCycle, pathLength + 1);
            }
        }
        
        return minCycle;
    }

    isEulerian() {
        if (!this.isConnected()) return false;
        
        // 检查所有顶点的度数是否为偶数
        return this.nodes.every(node => 
            this.edges.filter(e => e.from === node || e.to === node).length % 2 === 0
        );
    }

    isHamiltonian() {
        const n = this.nodes.length;
        if (n < 3) return false;
        
        // Dirac定理：如果图G是n(n≥3)个顶点的简单图，
        // 且每个顶点的度数不小于n/2，则G是哈密顿图
        return this.nodes.every(node => 
            this.edges.filter(e => e.from === node || e.to === node).length >= n/2
        );
    }

    floydWarshall() {
        const n = this.nodes.length;
        const dist = Array(n).fill().map(() => Array(n).fill(Infinity));
        
        // 初始化
        for (let i = 0; i < n; i++) dist[i][i] = 0;
        this.edges.forEach(edge => {
            const u = this.nodes.indexOf(edge.from);
            const v = this.nodes.indexOf(edge.to);
            dist[u][v] = 1;
            if (!this.isDirected) dist[v][u] = 1;
        });
        
        // Floyd-Warshall
        for (let k = 0; k < n; k++) {
            for (let i = 0; i < n; i++) {
                for (let j = 0; j < n; j++) {
                    if (dist[i][k] !== Infinity && dist[k][j] !== Infinity) {
                        dist[i][j] = Math.min(dist[i][j], dist[i][k] + dist[k][j]);
                    }
                }
            }
        }
        
        return dist;
    }

    // 添加新方法
    updateInputText() {
        const format = document.getElementById('inputFormat').value;
        const graphData = document.getElementById('graphData');
        
        if (format === 'edgeList') {
            // 边列表格式保持不变
            const nodesInEdges = new Set();
            const edgeLines = [];
            
            this.edges.forEach(edge => {
                nodesInEdges.add(edge.from.id);
                nodesInEdges.add(edge.to.id);
                const weight = edge.weight !== undefined ? ` ${edge.weight}` : '';
                edgeLines.push(`${edge.from.id} ${edge.to.id}${weight}`);
            });
            
            const isolatedNodes = this.nodes
                .filter(node => !nodesInEdges.has(node.id))
                .map(node => `${node.id}`);
            
            graphData.value = [...edgeLines, ...isolatedNodes].join('\n');
        } else {
            // 邻接矩阵格式使用 "+" 表示无权边
            const n = this.nodes.length;
            const matrix = Array(n).fill().map(() => Array(n).fill(0));
            
            this.edges.forEach(edge => {
                const i = this.nodes.findIndex(n => n.id === edge.from.id);
                const j = this.nodes.findIndex(n => n.id === edge.to.id);
                // 使用 "+" 表示无权边，数字表示有权边
                matrix[i][j] = edge.weight !== undefined ? edge.weight : '+';
                if (!this.isDirected) {
                    matrix[j][i] = edge.weight !== undefined ? edge.weight : '+';
                }
            });
            
            graphData.value = matrix.map(row => row.join(' ')).join('\n');
        }
    }

    exportDOT() {
        let dot = 'digraph G {\n';
        
        // 添加节点
        this.nodes.forEach(node => {
            dot += `    ${node.id};\n`;
        });
        
        // 添加边
        this.edges.forEach(edge => {
            const weight = edge.weight !== undefined ? ` [label="${edge.weight}"]` : '';
            if (this.isDirected) {
                dot += `    ${edge.from.id} -> ${edge.to.id}${weight};\n`;
            } else {
                dot += `    ${edge.from.id} -- ${edge.to.id}${weight};\n`;
            }
        });
        
        dot += '}';
        this.downloadFile('graph.dot', dot);
    }

    exportMatrix() {
        const n = this.nodes.length;
        const matrix = Array(n).fill().map(() => Array(n).fill(0));
        
        this.edges.forEach(edge => {
            const i = this.nodes.findIndex(n => n.id === edge.from.id);
            const j = this.nodes.findIndex(n => n.id === edge.to.id);
            matrix[i][j] = edge.weight || '+';
            if (!this.isDirected) {
                matrix[j][i] = edge.weight || '+';
            }
        });
        
        const matrixStr = matrix.map(row => row.join(' ')).join('\n');
        this.downloadFile('matrix.txt', matrixStr);
    }

    exportAdjacencyList() {
        let list = '';
        
        // 对于每个节点，找出它的邻接点
        this.nodes.forEach(node => {
            const neighbors = this.edges
                .filter(e => e.from.id === node.id || (!this.isDirected && e.to.id === node.id))
                .map(e => {
                    const neighborId = e.from.id === node.id ? e.to.id : e.from.id;
                    const weight = e.weight !== undefined ? ` (${e.weight})` : '';
                    return `${neighborId}${weight}`;
                })
                .join(' ');
            
            list += `${node.id}: ${neighbors}\n`;
        });
        
        this.downloadFile('adjacency_list.txt', list);
    }

    exportSVG() {
        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, 'svg');
        
        // 设置SVG属性
        svg.setAttributeNS(null, 'width', this.canvas.width);
        svg.setAttributeNS(null, 'height', this.canvas.height);
        svg.setAttributeNS(null, 'viewBox', `0 0 ${this.canvas.width} ${this.canvas.height}`);
        
        // 创建一个组来应用变换
        const g = document.createElementNS(svgNS, 'g');
        g.setAttributeNS(null, 'transform', 
            `translate(${this.offsetX},${this.offsetY}) scale(${this.scale})`
        );
        svg.appendChild(g);
        
        // 添加边
        this.edges.forEach(edge => {
            // 创建边的线条
            const line = document.createElementNS(svgNS, 'line');
            line.setAttributeNS(null, 'x1', edge.from.x);
            line.setAttributeNS(null, 'y1', edge.from.y);
            line.setAttributeNS(null, 'x2', edge.to.x);
            line.setAttributeNS(null, 'y2', edge.to.y);
            line.setAttributeNS(null, 'stroke', this.theme.edge.color);
            line.setAttributeNS(null, 'stroke-width', this.theme.edge.width);
            g.appendChild(line);

            // 如果是有向边，添加箭头
            if (edge.directed) {
                const dx = edge.to.x - edge.from.x;
                const dy = edge.to.y - edge.from.y;
                const angle = Math.atan2(dy, dx);
                const length = 15;

                const arrowX1 = edge.to.x - length * Math.cos(angle - Math.PI/6);
                const arrowY1 = edge.to.y - length * Math.sin(angle - Math.PI/6);
                const arrowX2 = edge.to.x - length * Math.cos(angle + Math.PI/6);
                const arrowY2 = edge.to.y - length * Math.sin(angle + Math.PI/6);

                const arrow = document.createElementNS(svgNS, 'path');
                arrow.setAttributeNS(null, 'd', 
                    `M ${edge.to.x} ${edge.to.y} L ${arrowX1} ${arrowY1} L ${arrowX2} ${arrowY2} Z`);
                arrow.setAttributeNS(null, 'fill', this.theme.edge.color);
                g.appendChild(arrow);
            }

            // 如果有权重，添加权重文本
            if (edge.weight !== undefined) {
                const text = document.createElementNS(svgNS, 'text');
                const midX = (edge.from.x + edge.to.x) / 2;
                const midY = (edge.from.y + edge.to.y) / 2;
                text.setAttributeNS(null, 'x', midX);
                text.setAttributeNS(null, 'y', midY);
                text.setAttributeNS(null, 'text-anchor', 'middle');
                text.setAttributeNS(null, 'dominant-baseline', 'middle');
                text.setAttributeNS(null, 'fill', this.theme.edge.fontColor);
                text.setAttributeNS(null, 'font-size', this.theme.edge.fontSize);
                text.textContent = edge.weight;
                g.appendChild(text);
            }
        });
        
        // 添加节点
        this.nodes.forEach(node => {
            const circle = document.createElementNS(svgNS, 'circle');
            circle.setAttributeNS(null, 'cx', node.x);
            circle.setAttributeNS(null, 'cy', node.y);
            circle.setAttributeNS(null, 'r', this.theme.node.radius);
            circle.setAttributeNS(null, 'fill', this.theme.node.fill);
            circle.setAttributeNS(null, 'stroke', this.theme.node.stroke);
            circle.setAttributeNS(null, 'stroke-width', '2');
            g.appendChild(circle);
            
            const text = document.createElementNS(svgNS, 'text');
            text.setAttributeNS(null, 'x', node.x);
            text.setAttributeNS(null, 'y', node.y);
            text.setAttributeNS(null, 'text-anchor', 'middle');
            text.setAttributeNS(null, 'dominant-baseline', 'middle');
            text.setAttributeNS(null, 'fill', this.theme.node.textColor);
            text.setAttributeNS(null, 'font-size', this.theme.node.fontSize);
            text.textContent = node.id;
            g.appendChild(text);
        });

        // 序列化SVG并下载
        const serializer = new XMLSerializer();
        let svgString = serializer.serializeToString(svg);
        
        // 添加XML声明和DOCTYPE
        svgString = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + 
                    '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" ' +
                    '"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">\n' + svgString;

        this.downloadFile('graph.svg', svgString);
    }

    downloadFile(filename, content) {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = filename;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
    }

    // 添加样式面板的初始化
    initializeStylePanel() {
        const stylePanel = document.querySelector('.style-panel');
        const header = stylePanel.querySelector('.style-panel-header');
        const closeButton = stylePanel.querySelector('.close-button');
        
        // 关闭按钮
        closeButton.addEventListener('click', () => {
            stylePanel.style.display = 'none';
        });

        // 拖动功能
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            initialX = e.clientX - xOffset;
            initialY = e.clientY - yOffset;
        });

        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                e.preventDefault();
                currentX = e.clientX - initialX;
                currentY = e.clientY - initialY;
                xOffset = currentX;
                yOffset = currentY;

                stylePanel.style.transform = 
                    `translate(${currentX}px, ${currentY}px)`;
            }
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // 样式控制
        document.getElementById('nodeSize').addEventListener('input', (e) => {
            this.theme.node.radius = parseInt(e.target.value);
            this.draw();
        });

        document.getElementById('nodeColor').addEventListener('input', (e) => {
            this.theme.node.fill = e.target.value;
            this.draw();
        });

        document.getElementById('edgeWidth').addEventListener('input', (e) => {
            this.theme.edge.width = parseInt(e.target.value);
            this.draw();
        });

        document.getElementById('edgeColor').addEventListener('input', (e) => {
            this.theme.edge.color = e.target.value;
            this.draw();
        });

        document.getElementById('fontSize').addEventListener('input', (e) => {
            this.theme.node.fontSize = parseInt(e.target.value);
            this.draw();
        });

        document.getElementById('edgeFontSize').addEventListener('input', (e) => {
            this.theme.edge.fontSize = parseInt(e.target.value);
            this.draw();
        });

        // 添加边权字体颜色控制
        document.getElementById('edgeFontColor').addEventListener('input', (e) => {
            this.theme.edge.fontColor = e.target.value;
            this.draw();
        });
    }
}

// 修改初始化方式，确保在DOM完全加载后再创建实例
window.addEventListener('load', () => {
    window.graphEditor = new GraphEditor();
}); 