import Backbone from 'backbone';

const HistoryModel = Backbone.Model.extend({
  defaults: {
    year: 0,
    title: '',
    lat: 36,
    lon: 139,
    location: '',
    isActive: false,
  },
});

export default HistoryModel;
