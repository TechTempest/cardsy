miro.onReady(() => {
  const icon =
    '<svg> <rect x="1" y="3" rx="1" ry="1" width="18" height="12" fill-rule="evenodd" fill="#ffffff" stroke="currentColor" stroke-width="2" opacity="1.0"/><rect x="1" y="3" rx="0" ry="1" width="2" height="12" fill-rule="evenodd" fill="currentColor" opacity="1.0" /><rect x="5" y="10" rx="1" ry="1" width="18" height="12" fill-rule="evenodd" fill="#ffffff" stroke="currentColor" stroke-width="2" opacity="1.0"/><rect x="5" y="10" rx="0" ry="1" width="2" height="12" fill-rule="evenodd" fill="currentColor" opacity="1.0" /><rect x="9" y="18" rx="0.5" ry="0.5" width="5" height="2" fill-rule="evenodd" fill="currentColor" opacity="0.3" /><rect x="16" y="18" rx="0.5" ry="0.5" width="5" height="2" fill-rule="evenodd" fill="currentColor" opacity="0.3" /></svg>';

  miro.initialize({
    extensionPoints: {
      bottomBar: {
        title: "Cardsy",
        tooltip: "Generate Cards",
        svgIcon: icon,
        onClick: async () => {
          const authorized = await miro.isAuthorized();
          if (authorized) {
            generateCards();
          } else {
            miro.board.ui.openModal("not-authorized.html").then((res) => {
              if (res === "success") {
                generateCards();
              }
            });
          }
        },
      },
    },
  });
});

async function generateCards() {
  // get selected widgets
  let selectedWidgets = await miro.board.selection.get();

  // filtering out shapes from all the selected widgets.
  selectedWidgets = selectedWidgets.filter((item) => {
    return ["SHAPE", "TEXT", "STICKER"].includes(item.type);
  });

  if (selectedWidgets.length == 0) {
    miro.showNotification("Select atleast one sticker, shape or text");
    return;
  }

  const cardsObjects = selectedWidgets.map((item) =>
    generatCardObjectFor(item, item.x + 800, item.y)
  );
  const cardsTags = selectedWidgets.map((item) => extractTags(item));

  const cardsGenerated = await miro.board.widgets.create(cardsObjects);
  const cardsIDs = cardsGenerated.map((item) => item.id);

  // sync tags with generated cards
  const updatedTagsObjects = getUpdatedTagsObjects(cardsIDs, cardsTags);
  const updatedtags = getSanitizedUpdatedTags(updatedTagsObjects);

  await miro.board.tags.update(updatedtags);
  await miro.board.selection.selectWidgets(cardsIDs);

  console.log(`Cardsy generated ${cardsIDs.length} cards for you.`);
  miro.showNotification(`Cardsy generated ${cardsIDs.length} cards.`);
}

const generatCardObjectFor = (object, x, y) => {
  let cardColor;

  if (object.type === "SHAPE") {
    //shape doesnt have tags
    //if shape has background color other than transparent then that will be card color otherwise shape's border color will be card color
    if (object.style.backgroundColor === "transparent") {
      if (object.style.borderColor === "transparent") {
        cardColor = "#2399f3"; // miro card default color #2399f3
      } else {
        cardColor = object.style.borderColor;
      }
    } else {
      cardColor = object.style.backgroundColor;
    }
  } else if (object.type === "TEXT") {
    //Text doesnt have tags
    //if text-box has background color other than transparent then that will be card color otherwise text-box's border color is other than transparent then that will be card color otherwise text-color will be card color
    if (object.style.backgroundColor === "transparent") {
      if (object.style.borderColor === "transparent") {
        if (object.style.textColor === "transparent") {
          cardColor = "#2399f3"; // miro card default color #2399f3
        } else {
          cardColor = object.style.textColor;
        }
      } else {
        cardColor = object.style.borderColor;
      }
    } else {
      cardColor = object.style.backgroundColor;
    }
  } else if (object.type === "STICKER") {
    //Stickers can have tags
    //sticker background color will be card color
    cardColor = object.style.stickerBackgroundColor;
  }

  const cardObject = {
    type: "card",
    title: object.plainText,
    x: x,
    y: y,
    style: {
      backgroundColor: cardColor,
    },
  };
  return cardObject;
};

const extractTags = (object) => {
  if (object.type !== "STICKER") {
    return [];
  } else {
    return object.tags.map((tag) => {
      return { id: tag.id, widgetIds: tag.widgetIds };
    });
  }
};

const addObjectToTag = (tag, objectId) => {
  return {
    id: tag.id,
    widgetIds: [...tag.widgetIds, objectId],
  };
};

const getUpdatedTagsObjects = (cardsIDs, cardsTags) => {
  const updatedTagsObjects = [];
  for (let i = 0; i < cardsIDs.length; i++) {
    const cardtags = cardsTags[i];
    const updatedCardTag = cardtags.map((tag) => {
      return addObjectToTag(tag, cardsIDs[i]);
    });
    updatedTagsObjects.push(updatedCardTag);
  }
  return updatedTagsObjects;
};

const getSanitizedUpdatedTags = (tags) => {
  const flattenedTags = _.flatten(tags);

  const groupedTags = _.groupBy(flattenedTags, "id");

  const tagsWithUpdatedWidgetIds = _.keys(groupedTags).map((key) => {
    return {
      id: key,
      widgetIds: _.uniq(
        _.flatten(groupedTags[key].map((tag) => tag.widgetIds))
      ),
    };
  });
  return tagsWithUpdatedWidgetIds;
};
