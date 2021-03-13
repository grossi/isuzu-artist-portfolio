import * as React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import Grid from '@material-ui/core/Grid';
import Typography from '@material-ui/core/Typography';
import Divider from '@material-ui/core/Divider';
import Markdown from 'components/Markdown';

const useStyles = makeStyles((theme) => ({
  markdown: {
    ...theme.typography.body2,
    padding: theme.spacing(3, 0),
  },
}));

interface MainProps {
  posts: Array<string>;
  title: string;
}

export default function Main(props: MainProps) {
  const classes = useStyles();
  const { posts, title } = props;
  const [loadedPosts, setLoadedPosts] = React.useState<string[]>([]);
  React.useEffect(() => {
    setLoadedPosts([]);
    for(let post of posts) {
      fetch(post)
      .then(data => data.text())
      .then(text => {
        setLoadedPosts(state => [...state, text]);
      });
    }
  }, [posts]);

  return (
    <Grid item xs={12} md={8}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      <Divider />
      {loadedPosts.map((post) => (
        <Markdown className={classes.markdown} key={post.substring(0, 40)}>
          {post}
        </Markdown>
      ))}
    </Grid>
  );
}
