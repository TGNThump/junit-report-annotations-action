const parser = require('xml2json');
const fs = require('fs');

(async () => {
    const data = await fs.promises.readFile("TEST-social.pantheon.activitystreams4j.W3CTests.xml");
    var json = JSON.parse(parser.toJson(data));
    console.log(json.testsuite.testcase.filter(tc => tc['system-out']).map(tc => tc['system-out']));
})();