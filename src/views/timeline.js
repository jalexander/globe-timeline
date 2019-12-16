import $ from 'jquery';
import _ from 'underscore';
import Backbone from 'backbone';
import 'slick-carousel';

const TimelineView = Backbone.View.extend({
  el: '.container',

  template: _.template($('#timeline-template').html()),

  events: {
    'click .timeline__item__info': 'onTimelineItemClick',
  },

  initialize() {
    _.bindAll(this,
      'render',
      'getCarouselInfo',
      'onTimelineItemClick',
      'resize');

    this.collection.bind('sync', this.render, this);

    this.collection.on('change:isActive', (model) => {
      if (model.get('isActive')) {
        const index = this.collection.indexOf(model);
        this.$carousel.slick('slickGoTo', index);
        this.getCarouselInfo(index);

        this.activeModelCid = model.cid;
      }
    });
  },

  render() {
    this.$timeline = $(this.template({ collection: this.collection })).appendTo(this.$el);

    let carouselSlideCount = 9;

    if (this.collection.length <= 3) {
      carouselSlideCount = 1;
    } else if (this.collection.length > 3 && this.collection.length <= 5) {
      carouselSlideCount = 3;
    } else if (this.collection.length > 5 && this.collection.length <= 7) {
      carouselSlideCount = 5;
    } else if (this.collection.length > 7 && this.collection.length <= 9) {
      carouselSlideCount = 7;
    }

    console.log('this.$timeline.find(.timeline__items)', this.$timeline.find('.timeline__items'))

    this.$carousel = this.$timeline.find('.timeline__items').slick({
      centerMode: true,
      slidesToShow: carouselSlideCount,
      slidesToScroll: 1,
      dots: false,
      variableWidth: false,
      infinite: false,
      draggable: false,
      prevArrow: this.$timeline.find('.timeline-arrow--prev'),
      nextArrow: this.$timeline.find('.timeline-arrow--next'),
    });

    this.$carousel.on('beforeChange', (event, slick, currentSlide, nextSlide) => {
      this.setActiveModel(nextSlide);
    });

    const activeModel = this.collection.first();
    this.activeModelCid = activeModel.cid;
    activeModel.set({
      isActive: true,
    });
  },

  onTimelineItemClick(event) {
    event.preventDefault();
    const $target = $(event.currentTarget);
    const index = $target.closest('.timeline__item').data('index');

    this.setActiveModel(index);
  },

  setActiveModel(index) {
    if (this.activeModelCid) {
      this.collection.get(this.activeModelCid).set({
        isActive: false,
      });
    }

    const activeModel = this.collection.at(index);
    activeModel.set({
      isActive: true,
    });
  },

  getCarouselInfo(index) {
    const $currentPos = this.$timeline.find(`[data-index="${index}"]`);

    this.$timeline.find('.slick-slide').css({ opacity: '' });

    // not possible to reverse select siblings in css, using jquery selector instead
    $currentPos.closest('.slick-slide')
      .prev()
      .css({ opacity: 1 })
      .prev()
      .css({ opacity: 0.8 })
      .prev()
      .css({ opacity: 0.4 })
      .prev()
      .css({ opacity: 0.2 });
  },

  resize() {
    this.$carousel.slick('slickGoTo', this.$carousel.slick('slickCurrentSlide'));
  },
});

export default TimelineView;
