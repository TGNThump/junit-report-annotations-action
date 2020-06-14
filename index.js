const core = require('@actions/core');
const github = require('@actions/github');
const glob = require('@actions/glob');
const parser = require('xml2json');
const fs = require('fs');
const path = require("path");





(async () => {
    try {
        const inputPath = core.getInput('path');
        const includeSummary = core.getInput('includeSummary');
        const numFailures = core.getInput('numFailures');
        const accessToken = core.getInput('access-token');
        const testSrcPath = core.getInput('testSrcPath');
        const globber = await glob.create(inputPath, {followSymbolicLinks: false});

        let annotations = [];
       

        for await (const file of globber.globGenerator()) {
            const data = await fs.promises.readFile(file);
            var json = JSON.parse(parser.toJson(data));

            if(json.testsuite) {
                const testsuite = json.testsuite;
                testFunction = async testcase => {
                    if (testcase.error || testcase.failure){
                        const klass = testcase.classname.replace(/$.*/g, '').replace(/\./g, '/').replace(/\(\)/, '');
                        const error = testcase.error ? testcase.error : testcase.failure;

                        annotations.push({
                            path: klass,
                            start_line: 0,
                            end_line: 0,
                            annotation_level: 'failure',
                            title: `JUnit Test "${testcase.name}" failed.`,
                            message: error['$t'],
                            raw_details: testcase['system-out'],
                          });
                    }

                    // if(testcase.failure) {
                    //     if(annotations.length < numFailures) {
                    //         const klass = testcase.classname.replace(/$.*/g, '').replace(/\./g, '/');
                    //         const filePath = `${testSrcPath}${klass}.java`
                    //
                    //         const fullPath = path.resolve(filePath)
                    //        
                    //        
                    //        
                    //
                    //        
                    //         const file = await fs.promises.readFile(filePath, {encoding: 'utf-8'});
                    //         //TODO: make this better won't deal with methods with arguments etc
                    //         let line = 0;
                    //         const lines = file.split('\n')
                    //             for(let i = 0; i < lines.length; i++) {
                    //             if(lines[i].indexOf(testcase.name) >= 0) {
                    //                 line = i;
                    //                 break;
                    //             }
                    //         }
                    //         console.info(`::notice file=${filePath},line=${line},col=0::Junit test ${testcase.name} failed ${testcase.failure.message}`)
                    //         console.info(`::debug file=${filePath},line=${line},col=0::Junit test ${testcase.name} failed ${testcase.failure.message}`)
                    //
                    //         console.info(`::warning file=${filePath},line=${line},col=0::Junit test ${testcase.name} failed ${testcase.failure.message}`)
                    //         annotations.push({
                    //             path: filePath,
                    //             start_line: line,
                    //             end_line: line,
                    //             start_column: 0,
                    //             end_column: 0,
                    //             annotation_level: 'failure',
                    //             message: `Junit test ${testcase.name} failed ${testcase.failure.message}`,
                    //           });
                    //     }
                    //     //add
                    // }
                }

                if(Array.isArray(testsuite.testcase)) {
                    for(const testcase of testsuite.testcase) {
                        await testFunction(testcase)
                    }
                }else {
                    //single test
                    await testFunction(testsuite.testcase)
                }
            }
        }

        const octokit = new github.GitHub(accessToken);
        const req = {
        ...github.context.repo,
        ref: github.context.sha
        }
        const res = await octokit.checks.listForRef(req);
        const jobName = process.env.GITHUB_JOB

        const checkRun = res.data.check_runs.find(check => check.name === jobName)
        if(!checkRun) {
            console.log(JSON.stringify(process.env))
            console.log(JSON.stringify(res.data.check_runs))
        }
        const check_run_id = checkRun.id

        const chunk = (arr, size) =>
            Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
                arr.slice(i * size, i * size + size)
            );

        for (const annotationChunk of chunk(annotations, 50)) {
            const update_req = {
                ...github.context.repo,
                check_run_id,
                output: {
                    title: "Junit Results",
                    summary: `Num passed etc`,
                    annotations: annotationChunk
                }
            }
            await octokit.checks.update(update_req);
        }
    } catch (error) {
   		core.setFailed(error.message);
    }
})();
