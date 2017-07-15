const algoliasearch = require('algoliasearch');
const _ = require('lodash');

const hitsPerPage = 5;
const applicationId = '0R8E5SPAFP';
const apiKey = '2ee58f908e6d720c4f72a9645ce0e857'; // search-only API key
const client = algoliasearch(applicationId, apiKey);
const index = client.initIndex('sonarwhal');

const isEqual = (l, r) => {
    // hits that have the same category, title and subtitles are considered the same
    const checks = ['category', 'title', 'subtitle'];

    return checks.every((check) => {
        return l[check] === r[check];
    });
};

const search = async (query, page) => {
    let content;
    const searchOptions = {
        highlightPostTag: `</span>`,
        highlightPreTag: `<span class="search-result__highlighted">`,
        hitsPerPage,
        page,
        query,
        snippetEllipsisText: `…`
    };

    try {
        content = await index.search(searchOptions);
    } catch (err) {
        console.error(err);

        return;
    }

    const hits = content.hits;
    const filteredHits = hits.map((hit) => {
        return {
            category: _.get(hit, '_highlightResult.hierarchy.lvl0.value') || 'Sonar',
            snippet: _.get(hit, '_snippetResult.content.value'),
            subtitle: _.get(hit, '_highlightResult.hierarchy.lvl2.value'),
            title: _.get(hit, '_highlightResult.hierarchy.lvl1.value'),
            url: _.get(hit, 'url')
        };
    });

    const uniqueHits = _.uniqWith(filteredHits, isEqual);
    const nbPages = content.nbPages; // number of pages

    return [uniqueHits, nbPages];
};

const generatePageInfo = (currentPage, hits, query, totalPages) => {
    const pattern = `/search/pageId?searchInput=${query}`;

    return {
        currentPage,
        hits,
        pattern,
        totalPages
    };
};

const configure = (app) => {
    app.get('/search/:pageId', async (req, res) => {
        const page = req.params.pageId;
        const searchInput = req.query.searchInput;

        const [searchResult, totalPages] = await search(searchInput, page - 1);

        res.render('search', generatePageInfo(parseInt(page), searchResult, searchInput, totalPages));
    });

    app.post('/search', async (req, res) => {
        const searchInput = req.body['search-input'];

        const [searchResult, totalPages] = await search(searchInput, 0);

        res.render('search', generatePageInfo(1, searchResult, searchInput, totalPages));
    });
};

module.exports = configure;
