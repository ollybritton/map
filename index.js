let Graph, data;

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

// standardiseText adds full stops to the end of description text and replaces quotes with typographical ones if neccessary.
function standardiseText(text) {
    if (!(text.endsWith(".") || text.endsWith("!") || text.endsWith("?"))) {
        text += "."
    }

    return text
}

// createInformation returns the HTML displaying information about a specific node.
function createInformation(node) {
    let headingLevel = 0;
    switch (node.type) {
        case "$subject":
            headingLevel = 1;
            break;
        case "$module":
            headingLevel = 2;
            break;
        case "$topic":
            headingLevel = 3;
            break;
        case "$subtopic":
            headingLevel = 4;
            break;
    }

    var output = "";

    output += `<h${headingLevel} class="node-name">${node.name}</h${headingLevel}>`
    
    
    let {parent, children, relates} = getLinks(node.id)
    
    if (parent != null) {
        output += `<i>Parent: <a href="javascript:void(0);" data-link-to="${parent.id}">${parent.name}</a></i>`
    }
    
    if (node.description != undefined) {
        output += `<p class="node-description">${standardiseText(node.description)}</p>`
    }
    
    if (node.examples != undefined && node.examples.length > 0) {
        output += `<hr />`
        output += `<h6>Examples</h6>`

        for (let example of node.examples) {
            output += `<blockquote>${example}</blockquote>`
        } 
    }

    if (children.length > 0 || relates.length > 0) {
        output += `<hr />`
        output += `<div class="links">`
        output += `<div class="children">`
        output += `<h6 class="node-info-heading">Children</h6 class="node-info-heading">`
        
        if (children.length == 0) {
            output += `<i>This topic has no children.</i>`
        } else {
            output += "<ul>"
            
            for (let child of children) {
                output += `<li class="child-link"><a href="javascript:void(0);" data-link-to="${child.id}">${child.name}</a></li>`    
            }
            
            output += "</ul>"
        }
        
        output += `</div>`
        output += `<div class="cross-topic">`
        output += `<h6 class="node-info-heading">Cross-topic links</h6 class="node-info-heading">`

        if (relates.length == 0) {
            output += `<i>This topic has no identified cross-topic links.</i>`
        } else {
            output += "<ul>"
            
            for (let linkedNode of relates) {
                output += `<li class="relates-link"><a href="javascript:void(0);" data-link-to="${linkedNode.id}">${linkedNode.name}</a></li>`    
            }

            output += "</ul>"
        }

        output += `</div>`
        output += `</div>`
    }

    

    console.log(getLinks(node.id))

    return output
}

// getNodeByID gets a node by the ID from the graph data.
function getNodeByID(id, data) {
    for (let node of data.nodes) {
        if (node.id == id) {
            return node
        }
    }
}

// getRelatedNodes gets the parent of this node if it exists and the list of nodes associated with it.
function getLinks(id) {
    let links = {
        parent: null,
        children: [],
        relates: []
    };

    for (let link of data.links) {
        if (link.type == "child") {
            if (link.target.id == id) {
                links.parent = link.source
            } else if (link.source.id == id) {
                links.children.push(link.target)
            }
        } else if (link.type == "relates") {
            if (link.source.id == id) {
                links.relates.push(link.target)
            } else if (link.target.id == id) {
                links.relates.push(link.source)
            }
        }
    }

    return links
}

// handleLink makes it so that links will zoom the graph.
function handleLink(e) {
    alert(e)
}

loadYAML("specs.yaml").then(specData => {
    data = graphFromYAML(specData)
    console.log(data)

    const elem = document.getElementById('graph');
    const info = document.getElementById('info');

    Graph = ForceGraph()(elem)
      .graphData(data)
      .nodeLabel('name')
      .nodeAutoColorBy('type')
      .nodeVal(calculateImportance)
      .linkDirectionalParticles(2)
      .linkDirectionalParticleWidth(1.4)
      .onNodeClick(handleNodeClick);
})

function handleNodeClick(node) {
    if (Graph.centerAt == undefined) {
        const distance = 40;
        const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);

        Graph.cameraPosition(
            { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, // new position
            node, // lookAt ({ x, y, z })
            1000  // ms transition duration
        );
    } else {
        Graph.centerAt(node.x, node.y, 500)
        Graph.zoom(8, 1000)
    }

    info.innerHTML = createInformation(node);
    MathJax.typeset()
}

function interceptClickEvent(e) {
    var target = e.target || e.srcElement;
    if (target.tagName === 'A') {
        var linkTo = target.getAttribute('data-link-to');
        var href = target.getAttribute("href")
        
        if (href != "javascript:void(0);") {
            return
        }
        
        e.preventDefault();
        node = getNodeByID(linkTo, data)

        handleNodeClick(node)
    }
}

document.addEventListener("click", interceptClickEvent)
