export function generateSparklineUrl(prices: number[]): string {
    if (!prices.length) return '';

    // 1. Determine color: Green if current price > start price, else Red
    const startPrice = prices[0];
    const endPrice = prices[prices.length - 1];
    const color = endPrice >= startPrice ? '#2ecc71' : '#e74c3c'; // Green or Red

    // 2. Build QuickChart config
    const chartConfig = {
        type: 'sparkline',
        data: {
            datasets: [{
                data: prices,
                borderColor: color,
                borderWidth: 3,
                fill: false,
                pointRadius: 0, // Clean line without dots
            }]
        },
        options: {
            layout: {
                padding: { left: 10, right: 10, top: 10, bottom: 10 }
            }
        }
    };

    // 3. Return encoded URL
    return `https://quickchart.io/chart?width=500&height=150&c=${encodeURIComponent(JSON.stringify(chartConfig))}`;
}