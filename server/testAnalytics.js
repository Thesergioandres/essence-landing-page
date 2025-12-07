import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const testAnalytics = async () => {
  try {
    const token = process.env.TEST_ADMIN_TOKEN || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY3NTI3MGUxNWNmYWJlMjRkZWEzMzJlNCIsImlhdCI6MTczMzUyMjE0NSwiZXhwIjoxNzM2MTE0MTQ1fQ.bpxkw7VBGBwFwMcLvp3FqOLlAL_hOOGN07XyXI9nR9I";
    
    const baseURL = "http://localhost:5000/api";
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    };

    console.log("🔍 PROBANDO ENDPOINTS DE ANALYTICS\n");

    // 1. Monthly Profit
    console.log("1️⃣ GET /api/analytics/monthly-profit");
    try {
      const { data } = await axios.get(`${baseURL}/analytics/monthly-profit`, config);
      console.log("✅ Success");
      console.log(`   Mes actual:`);
      console.log(`   - Revenue: $${data.currentMonth.revenue.toLocaleString()}`);
      console.log(`   - Ganancia: $${data.currentMonth.totalProfit.toLocaleString()}`);
      console.log(`   - Ventas: ${data.currentMonth.salesCount}`);
      console.log(`   - Unidades: ${data.currentMonth.unitsCount}`);
    } catch (error) {
      console.log("❌ Error:", error.response?.data?.message || error.message);
    }

    // 2. Sales Timeline
    console.log("\n2️⃣ GET /api/analytics/sales-timeline?days=30");
    try {
      const { data } = await axios.get(`${baseURL}/analytics/sales-timeline?days=30`, config);
      console.log("✅ Success");
      console.log(`   Días con datos: ${data.length}`);
      if (data.length > 0) {
        const latest = data[data.length - 1];
        console.log(`   Último día (${latest.date}):`);
        console.log(`   - Ventas: ${latest.sales}`);
        console.log(`   - Revenue: $${latest.revenue.toLocaleString()}`);
        console.log(`   - Ganancia: $${latest.profit.toLocaleString()}`);
      }
    } catch (error) {
      console.log("❌ Error:", error.response?.data?.message || error.message);
    }

    // 3. Financial Summary
    console.log("\n3️⃣ GET /api/analytics/financial-summary");
    try {
      const { data } = await axios.get(`${baseURL}/analytics/financial-summary`, config);
      console.log("✅ Success");
      console.log(`   Total Revenue: $${data.totalRevenue.toLocaleString()}`);
      console.log(`   Total Ganancia: $${data.totalProfit.toLocaleString()}`);
      console.log(`   Total Ventas: ${data.totalSales}`);
      console.log(`   Margen: ${data.profitMargin.toFixed(2)}%`);
    } catch (error) {
      console.log("❌ Error:", error.response?.data?.message || error.message);
    }

    // 4. Dashboard
    console.log("\n4️⃣ GET /api/analytics/dashboard");
    try {
      const { data } = await axios.get(`${baseURL}/analytics/dashboard`, config);
      console.log("✅ Success");
      console.log(`   Monthly Totals:`);
      console.log(`   - Revenue: $${data.monthlyTotals.totalRevenue.toLocaleString()}`);
      console.log(`   - Ganancia: $${data.monthlyTotals.totalProfit.toLocaleString()}`);
      console.log(`   - Ventas: ${data.monthlyTotals.totalSales}`);
      console.log(`   Top Productos: ${data.topProducts.length}`);
      console.log(`   Top Distribuidores: ${data.topDistributors.length}`);
    } catch (error) {
      console.log("❌ Error:", error.response?.data?.message || error.message);
    }

    // 5. Combined Summary
    console.log("\n5️⃣ GET /api/analytics/combined-summary");
    try {
      const { data } = await axios.get(`${baseURL}/analytics/combined-summary`, config);
      console.log("✅ Success");
      console.log(`   Normal: ${data.data.normal.count} ventas, $${data.data.normal.profit.toLocaleString()} ganancia`);
      console.log(`   Especial: ${data.data.special.count} ventas, $${data.data.special.profit.toLocaleString()} ganancia`);
      console.log(`   Combinado: ${data.data.combined.count} ventas, $${data.data.combined.profit.toLocaleString()} ganancia`);
    } catch (error) {
      console.log("❌ Error:", error.response?.data?.message || error.message);
    }

    console.log("\n✅ Pruebas completadas");
  } catch (error) {
    console.error("❌ Error general:", error.message);
  }
};

testAnalytics();
