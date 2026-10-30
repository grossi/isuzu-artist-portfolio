import * as React from 'react';
import { makeStyles } from "tss-react/mui";
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { useLanguage } from 'i18n/LanguageContext';

const useStyles = makeStyles()((theme) => ({
  footer: {
    backgroundColor: theme.palette.background.paper,
    marginTop: theme.spacing(8),
    padding: theme.spacing(2),
  },
}));

export default function Footer() {
  const { classes } = useStyles();
  const { t } = useLanguage();

  return (
    <footer className={classes.footer}>
      <Container maxWidth="lg">
        <Typography variant="body2" color="text.secondary" align="center">
          {t('footer.copyright', { year: new Date().getFullYear() })}
        </Typography>
      </Container>
    </footer>
  );
}
