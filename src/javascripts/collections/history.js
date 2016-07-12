import Backbone from 'backbone';
import HistoryModel from '../models/history';

const HistoryCollection = Backbone.Collection.extend({
  model: HistoryModel,
  url: './data/history.json',

  beforeYear(year) {
    const filtered = this.filter(history => history.get('year') < year);
    return new HistoryCollection(filtered);
  },
});

export default HistoryCollection;
