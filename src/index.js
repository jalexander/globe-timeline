import _ from 'underscore';
import GlobeView from './views/globe';
import TimelineView from './views/timeline';
import HistoryCollection from './collections/history';

import './styles/main.scss';

class App {
  constructor() {
    this.collection = new HistoryCollection();

    this.globe = new GlobeView({
      collection: this.collection,
    });

    this.timeline = new TimelineView({
      collection: this.collection,
    });

    this.collection.fetch();

    window.addEventListener('resize', _.debounce(() => {
      this.resize();
    }, 250), false);
  }

  resize() {
    this.globe.resize();
    this.timeline.resize();
  }
}

const app = new App();
