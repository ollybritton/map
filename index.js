// loadYAML returns the data in the specs.yaml file, parsed into an object by js-yaml.
function loadYAML(filename) {
    return new Promise(resolve => {
        fetch(filename).then(res => {
            res.text().then(data => {
                resolve(jsyaml.load(data));
            })
        });
    })
}

// createID creates an ID from a topic or subject name by converting it to lower case and replacing spaces with dashes.
// This could fail for names containing whitespace other than a space but that is not present in the input.
function createID(name) {
    return name.toLowerCase().replaceAll(" ", "-").replaceAll("'", "")
}

// graphFromYAML converts the data from the format in specs.yaml into the format that force-graph expects.
// This is done using tail-call recursion.
function graphFromYAML(specData) {
    let frontier = specData.map(x => [x, null])
    
    let nodes = []
    let links = []

    while (frontier.length != 0) {
        let [node, outer] = frontier.shift(0)
        let id = ( node.id == undefined ) ? createID(node.name) : node.id
        
        let copy = Object.assign({}, node)
        copy.id = id

        // Handle links; it can either be a singular "link" field or an array of links.
        if (node.link != undefined) {
            links.push({ source: id, target: node.link, type: "relates" })
        }

        if (node.links != undefined) {
            for (let link of node.links) {
                links.push({ source: id, target: link, type: "relates" })
            }
        }

        if (outer != null) {
            links.push({ source: outer, target: id, type: "child" })
        }

        nodes.push(copy)

        if (node.type == "$subject" && node.modules != undefined) {
            frontier.push(...node.modules.map(x => [x, id]))
        } else if (node.type == "$module" && node.topics != undefined) {
            frontier.push(...node.topics.map(x => [x, id]))
        } else if (node.type == "$topic" && node.subtopics != undefined) {
            frontier.push(...node.subtopics.map(x => [x, id]))
        } else if (node.type == "$subtopic" && node.subtopics != undefined) {
            frontier.push(...node.subtopics.map(x => [x, id]))
        }
    }
    
    return {
        nodes: nodes,
        links: links,
    }
}

// calculateImportance calculates the importance of a node by considering its type (e.g. "subject", "subtopic") and its connections to other nodes.
function calculateImportance(node) {
    let base = 0;

    switch (node.type) {
        case "$subject":
            base = 20;
            break;
        case "$module":
            base = 8;
            break;
        case "$topic":
            base = 5;
            break;
        case "$subtopic":
            base = 3;
            break;
    }
    
    return base
}

loadYAML("specs.yaml").then(specData => {
    let data = graphFromYAML(specData)
    console.log(data)

    const elem = document.getElementById('graph');

    const Graph = ForceGraph()(elem)
      .graphData(data)
      .nodeLabel('name')
      .nodeAutoColorBy('type')
      .nodeVal(calculateImportance)
      .linkDirectionalParticles(2)
      .linkDirectionalParticleWidth(1.4)
      .onNodeClick(node => {
        // Center/zoom on node
        Graph.centerAt(node.x, node.y, 500);
        Graph.zoom(8, 1000);
      });
})