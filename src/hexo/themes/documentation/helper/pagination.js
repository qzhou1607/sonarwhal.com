module.exports = {
    generate: (current, total, pattern, client, options) => {
        const getFirst = function (c, t, p) {
            return [{
                active: false,
                page: 1,
                url: p.replace('pageId', 1)
            }];
        };

        const getLast = function (c, t, p) {
            return [{
                active: false,
                page: t,
                url: p.replace('pageId', t)
            }];
        };

        const firstItems = function (c, t, p) {
            const pages = [];
            const block = [];
            const max = Math.min(t, 5);

            for (let i = 1; i <= max; i++) {
                block.push({
                    active: i === c,
                    page: i,
                    url: p.replace('pageId', i)
                });
            }
            pages.push(block);
            if (max < t) {
                pages.push(getLast(c, t, p));
            }

            return pages;
        };

        const middlePage = (c, t, p) => {
            const pages = [];
            const block = [];
            const max = Math.min(c + 2, t);
            const min = Math.max(c - 2, 1);

            if (min > 1) {
                pages.push(getFirst(c, t, p));
            }

            for (let i = min; i <= max; i++) {
                block.push({
                    active: i === c,
                    page: i,
                    url: p.replace('pageId', i)
                });
            }
            pages.push(block);

            if (max < t) {
                pages.push(getLast(c, t, p));
            }

            return pages;
        };

        const lastItems = function (c, t, p) {
            const pages = [];
            const block = [];
            const min = Math.max(1, t - 4);

            if (min > 1) {
                pages.push(getFirst(c, t, p));
            }

            for (let i = min; i <= t; i++) {
                block.push({
                    active: i === c,
                    page: i,
                    url: p.replace('pageId', i)
                });
            }
            pages.push(block);

            return pages;
        };

        const context = {
            hidePagination: true,
            next: null,
            pages: [],
            pattern,
            prev: null
        };

        if (!options) {
            options = client; //eslint-disable-line no-param-reassign
        }

        if (!total || total <= 1) {
            return options.fn(context);
        }

        context.hidePagination = false;

        if (current !== 1) {
            const previousPage = current - 1;

            context.prev = {
                page: previousPage,
                url: pattern.replace('pageId', previousPage)
            };
        }

        if (current !== total) {
            const nextPage = current + 1;

            context.next = {
                page: nextPage,
                url: pattern.replace('pageId', nextPage)
            };
        }

        let pages;

        if (current <= 5) {
            pages = firstItems(current, total, pattern);
            context.pages = pages;

            return options.fn(context);
        }

        if (current >= total - 5) {
            pages = lastItems(current, total, pattern);
            context.pages = pages;

            return options.fn(context);
        }

        if (current > 5) {
            pages = middlePage(current, total, pattern);
            context.pages = pages;

            return options.fn(context);
        }

        return options.fn(context);
    }
};
