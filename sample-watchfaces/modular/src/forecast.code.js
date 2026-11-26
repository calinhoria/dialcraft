{
  // The next five days (tomorrow first): the weekday, the day's high and low and the day's condition picture, from the watch's own forecast
  // (forecastData.data[0] is today, [1] tomorrow ...). Without weather data the editor's labels and pictures stay.
  const IC = [/*COLX*/];
  const IC_Y = /*ICY*/0;
  const DN = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const apply = () => {
    let list = [];
    try {
      const wx = new DCWeather();
      const f = wx.getForecastWeather ? wx.getForecastWeather() : wx.getForecast();
      list = (f && f.forecastData && f.forecastData.data) || [];
    } catch (e) { /* no weather on this watch */ }
    const d0 = new Date().getDay();
    for (let i = 0; i < 5; i++) {
      try { W['fc' + i + '_d'].setProperty(ui.prop.TEXT, DN[(d0 + i + 1) % 7]) } catch (e) {}
      const it = list[i + 1];
      if (!it) continue;
      if (it.high !== undefined) { try { W['fc' + i + '_t'].setProperty(ui.prop.TEXT, String(Math.round(+it.high))) } catch (e) {} }
      if (it.low !== undefined) { try { W['fc' + i + '_l'].setProperty(ui.prop.TEXT, String(Math.round(+it.low))) } catch (e) {} }
      const k = +it.index;
      if (k >= 0 && k < 29) { try { W['fc' + i + '_ic'].setProperty(ui.prop.MORE, { x: pxv(IC[i]), y: pxv(IC_Y), src: F['fc' + i + '_ic'][k + 1] }) } catch (e) {} }
    }
  };
  apply();
  setInterval(apply, 600000);
  // the timers stop while the screen is off, so the labels stayed on an old day until the face was re-selected: refresh when it wakes up too
  try { ui.createWidget(ui.widget.WIDGET_DELEGATE, { resume_call: apply }) } catch (e) {}
}
