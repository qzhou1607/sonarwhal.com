const _ = require('lodash');
const pify = require('pify');
const fs = pify(require('fs'));
const klaw = require('klaw');
const path = require('path');
const normalize = require('normalize-path');
const md2json = require('md-2-json');
const json2yaml = require('json2yaml');
const marked = require('marked');

const directory = path.resolve(process.argv[2]); // path to the folder that contains md files
const filePaths = [];
const ignoredFiles = ['404.md', 'about.md', 'contributors.md'];

const permaLinks = new Map(); // a collection of permalinks
const divider = '---';

console.log('Updater is initiated.');

// Make sure the options used here are the same as used in `hexo`.
marked.setOptions({
    autolink: true,
    breaks: false,
    gfm: true,
    pedantic: false,
    sanitize: false,
    smartLists: true,
    smartypants: true,
    tables: true
});

const isIgnoredFile = (filePath) => {
    const file = path.basename(filePath);

    return _.includes(ignoredFiles, file);
};
const insertFrontMatterItemIfExist = (itemName, itemValue, frontmatter) => {
    if (itemValue) {
        const tocTitleFrontMatter = `${itemName}: ${itemValue}`;

        frontmatter.unshift(tocTitleFrontMatter);
    }
};

const getLayout = (filePath) => {
    const validLayouts = ['home', 'changelog', 'docs', '404', 'about'];

    const current = validLayouts.find((template) => {
        return filePath.toLowerCase().includes(template);
    });

    return current;
};

const generateFrontMatterInfo = (filePath, title) => {
    let relativePath = path.relative(directory, filePath);
    let root = '';
    let index;
    let baseName;

    if (_.startsWith(relativePath, 'docs')) {
        relativePath = path.relative('docs', relativePath);
        root = 'docs';
    }
    baseName = path.basename(relativePath, '.md');
    const indexMatch = baseName.match(/(^\d+)-/);

    if (indexMatch) {
        index = indexMatch.pop();

        baseName = baseName.replace(indexMatch.pop(), '');
    }

    const [category, tocTitle] = path.dirname(relativePath).split(path.sep);
    const permaLink = normalize(path.join(root, path.dirname(relativePath), `${baseName}.html`)).toLowerCase();

    const categoryFrontMatter = `category: ${_.trim(category, '.') ? category : 'doc-index'}`;
    const permalinkFrontMatter = `permalink: ${permaLink}`;
    const template = getLayout(filePath);
    const frontMatter = [categoryFrontMatter, permalinkFrontMatter, divider];

    permaLinks.set(baseName, permaLink); // populate permaLinks

    insertFrontMatterItemIfExist('layout', template, frontMatter);
    insertFrontMatterItemIfExist('tocTitle', tocTitle, frontMatter);
    insertFrontMatterItemIfExist('title', title, frontMatter);

    if (index) {
        const indexFrontMatter = `index: ${index}`;

        frontMatter.unshift(indexFrontMatter);
    }

    frontMatter.unshift(divider);

    return frontMatter.join('\n');
};

const addFrontMatter = async (filePath) => {
    let content;
    let currentFromMatter;
    let title;
    const data = await fs.readFile(filePath, 'utf8');
    // Match divider between line breaks.
    const frontMatterRegex = new RegExp(`[\r\n|\n]\s*${divider}[\r\n|\n]|^\s*${divider}[\r\n|\n]`, 'gi'); // eslint-disable-line no-useless-escape

    if (frontMatterRegex.test(data)) {
        // front matter already exists in this file, will update it
        [, currentFromMatter, content] = data.split(frontMatterRegex); // ['', '<front matter>', '<Actual content in the markdown file>']
    } else {
        content = data;
    }

    if (currentFromMatter) {
        return;
    }

    content = content || ''; // Replace `undefined` with empty string.

    // extract the first title in markdown file and remove the abbreviation in parenthesis
    // example: '\r\n# Disallow certain HTTP headers (`disallow-headers`)\r\n\r\n' => 'Disallow certain HTTP headers'
    const titleMatch = content.match(/# (.*)(\n|\r\n)/);

    if (titleMatch) {
        title = _.trim(titleMatch[1].replace(/\(.*\)/, ''));
    }

    const frontMatter = generateFrontMatterInfo(filePath, title);

    const newData = `${frontMatter}\n${content}`;

    await fs.writeFile(filePath, newData);

    // Generate yaml file containing changelog data.
    if (filePath.toLowerCase().includes('changelog.md')) {
        const parsedChangelog = md2json.parse(data);

        _.forEach(parsedChangelog, (details) => {
            // Iterate each date.
            _.forEach(details, (update) => {
                // Iterate each category of update.

                // Line breaks in `0.1.0` can't be ignored after being parsed in `md2json`.
                // So `raw` needs to be processed to prevent unexpected line breaks.
                const raw = update.raw.split(new RegExp('-\\n-|([^.])\\n-')).join('');
                const commitRegex = /- \[\[`[a-z0-9]+`\]\(https:\/\/github.com\/sonarwhal\/sonar\/commit\/([a-z0-9]+)\)] - (.*)(?:\r?\n)*/g;
                const associateCommitRegex = / \(see also: \[`#[0-9]+`\]\(https:\/\/github.com\/sonarwhal\/sonar\/issues\/([0-9]+)\)\)/g;
                let matchArray;

                update.html = marked(raw);
                update.details = {}; // Changlog item details including `associatedCommitId` and `message`.

                // Extract changelog item details.
                while ((matchArray = commitRegex.exec(raw)) !== null) {
                    const message = matchArray.pop();
                    const id = matchArray.pop();
                    const associateCommit = associateCommitRegex.exec(message);

                    update.details[id] = {
                        associateCommitId: associateCommit ? associateCommit.pop() : null,
                        message: message.replace(associateCommitRegex, '')
                    };
                }
            });
        });
        const yaml = json2yaml.stringify(parsedChangelog);
        const changelogThemePath = path.join(directory, '_data/changelog.yml');

        await fs.writeFile(changelogThemePath, yaml);
    }
};

// Iterate all the markdown files and add frontmatter to each file
klaw(directory)
    .on('data', (item) => {
        if (_.endsWith(item.path, '.md') && !isIgnoredFile(item.path)) {
            filePaths.push(item.path);
        }
    })
    .on('error', (err, item) => {
        console.log(err.message, item.path);
    })
    .on('end', async () => {
        const addFrontMatterPromises = filePaths.map(addFrontMatter);

        await Promise.all(addFrontMatterPromises);
        console.log('Front Matter added to each file.');
    });
