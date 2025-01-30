const storeData = {
    policies: {
        shipping: {
            methods: [
                { name: 'Canada Standard', time: '5-10 business days' },
                { name: 'US Standard', time: '5-10 business days' },
                { name: 'Australia and UK', time: '10-18 business days' },
                { name: 'Rest of World', time: '10-22 business days' }
            ],
            processing: '48 hours for in-stock items',
            notes: [
                'Please double-check your shipping address before ordering',
                'We\'re not responsible for customs fees',
                'Tracking provided for all orders'
            ]
        },
        returns: {
            timeframe: '14 days',
            conditions: [
                'Items must be in original condition',
                'Must be unworn',
                'All tags must be attached'
            ],
            process: [
                'Contact via email before shipping returns',
                'Use Return Portal',
                'Ship to provided return address'
            ]
        }
    },
    sizingLogic: {
        tops: {
            xs: { weightRange: [45, 60], heightRange: [150, 165] },
            s: { weightRange: [55, 70], heightRange: [160, 175] },
            m: { weightRange: [65, 80], heightRange: [170, 180] },
            l: { weightRange: [75, 90], heightRange: [175, 185] },
            xl: { weightRange: [85, 100], heightRange: [180, 190] },
            xxl: { weightRange: [95, 120], heightRange: [185, 200] }
        }
    }
};

module.exports = storeData; 
