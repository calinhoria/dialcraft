{
  // Five-day forecast: the day names, the weather picture and low/high for each day, from the watch's own weather data.
  // Without data (no weather yet, or no permission) the labels and pictures from the editor stay.
  const DN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const IC = [[47, 326], [112, 326], [186, 326], [260, 326], [334, 326]];
  const apply = () => {
    let list = [];
    try {
      const wx = new DCWeather();
      const f = wx.getForecastWeather ? wx.getForecastWeather() : wx.getForecast();
      list = (f && f.forecastData && f.forecastData.data) || [];
    } catch (e) { /* no weather on this watch */ }
    const d0 = new Date().getDay();
    for (let i = 0; i < 5; i++) {
      try { W['fc' + i + '_d'].setProperty(ui.prop.TEXT, DN[(d0 + i) % 7]) } catch (e) {}
      const it = list[i];
      if (!it) continue;
      try { if (it.low !== undefined && it.high !== undefined) W['fc' + i + '_t'].setProperty(ui.prop.TEXT, Math.round(it.low) + '/' + Math.round(it.high)) } catch (e) {}
      try { const k = +it.index; if (k >= 0 && k < 29) W['fc' + i + '_ic'].setProperty(ui.prop.MORE, { x: pxv(IC[i][0] - 10), y: pxv(IC[i][1]), src: F['fc' + i + '_ic'][k] }) } catch (e) {}
    }
  };
  apply();
  setInterval(apply, 600000);
}
