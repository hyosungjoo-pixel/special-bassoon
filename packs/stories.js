/*
 * Pack: guided stories. Each step shows a node, says one thing out loud, and can run an action.
 * Stories are how the three systems become one connected tale.
 */
(function (A) {
  'use strict';

  A.story({
    id: 'lunch',
    title: 'Where does lunch go?',
    steps: [
      { node: 'body', say: 'This is {name}. Let\'s follow one lunch all the way through, and see what else happens on the way.', run: { action: 'eat', option: 'lunch' } },
      { node: 'mouth', say: 'Chomp. Teeth break the food up, and spit starts turning starch into sugar.' },
      { node: 'stomach', say: 'Down the food pipe into the stomach. The acid in here kills lots of germs that came in with the food. That\'s the first bit of the immune system in our story.' },
      { node: 'smallIntestine', say: 'A little at a time, the soupy food is squirted into the small intestine, a long folded tube.' },
      { node: 'villus', say: 'The wall is covered in tiny fingers called villi. Sugar from lunch crosses into the blood vessels inside them.' },
      { node: 'sglt1', say: 'Up close, this is the door that lets sugar in. It only turns when salt comes through with it.' },
      { node: 'blood', say: 'Now lunch is in {name}\'s blood. Blood sugar goes up a little, then insulin and the liver bring it back down.' },
      { node: 'heart', say: 'The heart pumps that blood everywhere. Let\'s go for a run and use the fuel.', run: { action: 'run' } },
      { node: 'rbc', say: 'Running muscles need lots of oxygen. Red blood cells drop off more of it where muscles are working hard.' },
      { node: 'skin', say: 'Oops, a fall on the run. Germs get into the scrape.', run: { action: 'germ', option: 'scrape' } },
      { node: 'neutrophil', say: 'White blood cells called neutrophils squeeze out of the blood vessels and head for the scrape to eat the germs.' },
      { node: 'lymphNode', say: 'For trickier germs, lymph nodes train a special army. A vaccine is a safe way to practise.' },
      { node: 'antibody', say: 'That army makes antibodies that grab one exact germ, and memory that lasts. What do you want to explore next?' },
    ],
  });
})(window.Atlas);
